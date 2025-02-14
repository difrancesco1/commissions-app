const fs = require("fs").promises;
const path = require("path");
const process = require("process");
const { authenticate } = require("@google-cloud/local-auth");
const { google } = require("googleapis");

const admin = require("firebase-admin");
const serviceAccount = require("./commissions-app-c6e2c-firebase-adminsdk-fbsvc-473cacb7d7.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://commissions-app-c6e2c.firebaseio.com",
});

const db = admin.firestore(); // Using Firestore as the database

const SCOPES = ["https://www.googleapis.com/auth/gmail.modify"];
// // The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), "/src/API/token.json");
const CREDENTIALS_PATH = path.join(process.cwd(), "/src/API/credentials.json");

// const TOKEN_PATH = path.join(process.cwd(), "/token.json");
// const CREDENTIALS_PATH = path.join(process.cwd(), "/credentials.json");

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

/**
 * Serializes credentials to a file compatible with GoogleAuth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: "authorized_user",
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

/**
 * Lists the labels in the user's account.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */

let emailId = 0; // Initialize ID counter

// store in DB
async function storeEmailInFirebase(emailData) {
  try {
    const commissionDueDateRef = db.collection("commissionDueDate");
    // Generates a document ID
    const docRef = db
      .collection("commissions")
      .doc(emailData["mcomm_type"] + emailData["mtwitter"]);

    // // calculate due date - date on form + 7 + emailid
    // var dueDate = new Date(emailData["mdate"]);
    // dueDate.setDate(dueDate.getDate() + emailId + 7);

    // calculate paydue (msgdate + 30 days)
    let payDue = new Date(); // Now
    payDue.setDate(payDue.getDate() + 30);

    // Try setting the data
    await docRef.set({
      ID: emailData["mcomm_type"] + emailData["mtwitter"],
      NAME: emailData["mname"],
      COMM_START_DATE: emailData["mdate"], // when the first commission is to start
      PAYDUE: payDue, // when the payment is due -> move to archive after 30 days
      DUE: "", // set after someone pays - logic is +1 whoever is in queue , first person is +7 of comm_start_date
      TWITTER: emailData["mtwitter"],
      COMM_TYPE: emailData["mcomm_type"], // commission type (A02) -> alerts from febuary
      COMM_NAME: emailData["mcomm_name"], // full name of commission
      EMAIL: emailData["memail"], // email to send commission
      PAYPAL: emailData["mpaypal"], // paypal email
      MSG_ID: emailData["messageId"],
      IMG1: emailData["attachmentId"], // Add file handling if needed later
      NOTES: "add note :3", // empty for now
      COMPLETE: false,
      ARCHIVE: false, // if true, is archived
      PAID: false,
      COMPLEX: emailData["mcomplex"] === "true", // set true depending on email data
      EMAIL_PAY: false,
      EMAIL_COMP: false,
      EMAIL_COMPPAY: false,
      EMAIL_WIP: false,
    });

    // Check if the COMM_TYPE already exists in 'commissionDueDate'
    const commTypeDoc = await commissionDueDateRef
      .doc(emailData["mcomm_type"])
      .get();

    if (!commTypeDoc.exists) {
      // If the COMM_TYPE does not exist, create a new document
      await commissionDueDateRef.doc(emailData["mcomm_type"]).set({
        COMM_START_DATE: emailData["mdate"],
      });

      console.log(
        `New commission type ${emailData["mcomm_type"]} added to commissionDueDate.`,
      );
    }
    console.log(
      `Email for ${emailId} ${emailData["mcomm_type"]}${emailData["mtwitter"]} stored in Firebase.`,
    );
    emailId++; // Increment ID for the next email
  } catch (error) {
    console.error("Error storing email in Firebase:", error);
  }
}

async function markEmailAsRead(auth, messageId) {
  const gmail = google.gmail({ version: "v1", auth });

  try {
    // Remove the unread label and mark as read
    await gmail.users.messages.modify({
      userId: "me",
      id: messageId,
      resource: {
        removeLabelIds: ["UNREAD"],
      },
    });
    console.log(`Email ${messageId} has been marked as read`);
  } catch (error) {
    console.log(`Error marking email ${messageId} as read: ${error}`);
  }
}

async function fetchEmails(auth) {
  const gmail = google.gmail({ version: "v1", auth });

  // prevent duplicates -> sent side by side usually
  const commsInDatabase = [];
  const failedEmailNames = [];
  const emailReq = 'is:unread (subject:"- DO NOT OPEN -")';
  // const emailReq = 'is:unread (subject:"TWITCH ALERTS")';

  try {
    // List the latest 10 emails fetched
    const res = await gmail.users.messages.list({
      userId: "me",
      labelIds: ["INBOX"], // Only fetch emails from indox
      // Add Queries like 'is:unread' 'subject:TWITCH ALERTS' 'from:specific_email@example.com' - new commission - DO NOT OPEN - app will not update if read -
      q: emailReq,
    });

    // If there are no new emails exit loop
    const messages = res.data.messages;
    if (!messages || messages.length === 0) {
      console.log("no new emails " + emailReq);
      return;
    }

    console.log("fetching emails...\n");

    // Fetch details of each email
    for (const message of messages) {
      const messageId = message.id;

      const msg = await gmail.users.messages.get({
        userId: "me",
        id: message.id,
        format: "full",
      });

      // try parsing and saving to database
      try {
        // sort through message body -----------------------------------------------------------------------------------
        const msgBody = atob(
          msg.data.payload.parts[0].body.data
            .replace(/-/g, "+")
            .replace(/_/g, "/"),
        ).split("\r\n");
        const memail = msgBody[11];
        if (commsInDatabase.includes(memail.toLowerCase())) {
          continue;
        }
        commsInDatabase.push(memail.toLowerCase());

        const mname = msgBody[7];
        const msgDate = msgBody[1].split("/");
        const mdate = new Date(msgDate[2], msgDate[0] - 1, msgDate[1]); // -1 because months begin with 0
        const mcomm_type = msgBody[3];
        const mcomm_name = msgBody[5];
        var mtwitter = msgBody[9];
        // scrape data to only include username
        if (mtwitter.includes("/")) {
          mtwitter = mtwitter.split("/").pop();
        } else if (mtwitter.includes("@")) {
          mtwitter = mtwitter.split("@").pop();
        }
        const mpaypal = msgBody[13];
        const mcomplex = msgBody[15];
        // -----------------------------------------------------------------------------------

        // // OLD EMAIL PULL -----------------------------------------------------------------------------------
        // const msgBody = atob(
        //   msg.data.payload.parts[0].body.data
        //     .replace(/-/g, "+")
        //     .replace(/_/g, "/"),
        // ).split("\r\n");
        // const memail = msgBody[5];
        // // check for duplicates
        // if (commsInDatabase.includes(memail)) {
        //   continue;
        // }
        // commsInDatabase.push(memail.toLowerCase());
        // const mdate = new Date(2025, 2, 1); // -1 because months begin with 0
        // const mcomm_type = "A03";
        // const mcomm_name = "animated alerts bundle";
        // const mname = msgBody[0].split(" ")[1];
        // var mtwitter = msgBody[1].split(" ")[1];
        // // scrape data to only include username
        // if (mtwitter.includes("/")) {
        //   mtwitter = mtwitter.split("/").pop();
        // } else if (mtwitter.includes("@")) {
        //   mtwitter = mtwitter.split("@").pop();
        // }
        // const mpaypal = "N/A";
        // const mcomplex = msgBody[2].split(" ")[1];
        // // -----------------------------------------------------------------------------------

        // // OLD OLD EMAIL PULL -----------------------------------------------------------------------------------
        // const msgBody = atob(
        //   msg.data.payload.parts[0].body.data
        //     .replace(/-/g, "+")
        //     .replace(/_/g, "/"),
        // ).split("\r\n");

        // const memail = msgBody[4];
        // // check for duplicates
        // if (commsInDatabase.includes(memail)) {
        //   continue;
        // }
        // commsInDatabase.push(memail.toLowerCase());
        // const mdate = new Date(2025, 2, 1); // -1 because months begin with 0
        // const mcomm_type = "A03";
        // const mcomm_name = "animated alerts bundle";
        // const mname = msgBody[0].split(" ")[1];
        // var mtwitter = msgBody[1].split(" ")[1];
        // // scrape data to only include username
        // if (mtwitter.includes("/")) {
        //   mtwitter = mtwitter.split("/").pop();
        // } else if (mtwitter.includes("@")) {
        //   mtwitter = mtwitter.split("@").pop();
        // }
        // const mpaypal = "N/A";
        // const mcomplex = msgBody[2].split(" ")[1];
        // // -----------------------------------------------------------------------------------

        // get attachment
        const attachmentId = getAttachmentIds(msg.data.payload.parts);
        saveEmailAttachment(
          gmail,
          messageId,
          attachmentId,
          mcomm_type,
          mtwitter,
        );

        // Store in Firebase
        await storeEmailInFirebase({
          messageId,
          attachmentId,
          mdate,
          mcomm_type,
          mcomm_name,
          mname,
          mtwitter,
          memail,
          mpaypal,
          mcomplex,
        });

        // mark as read when all is successful
        await markEmailAsRead(auth, messageId);
      } catch (err) {
        const subjectHeader = msg.data.payload.headers.find(
          (header) => header.name === "Subject",
        );
        const dateHeader = msg.data.payload.headers.find(
          (header) => header.name === "Date",
        );
        failedEmailNames.push(
          dateHeader["value"] +
            ": " +
            subjectHeader["value"] +
            "(" +
            messageId +
            "\)" +
            " " +
            err,
        );
        failedEmailNames.push();
      }
    }
    console.log(failedEmailNames);
    // Catch err if any
  } catch (err) {
    console.error("The API returned an error: " + err);
  }
}

// checking if user has iamge saved in their directory, if not, pull from gmail and save
async function checkAndSaveEmailAttachment(auth, id, messageId, attachmentId) {
  const gmail = google.gmail({ version: "v1", auth });
  const filePath = `./images/${id}.png`; // created filepath for reusability

  try {
    // If the file exists, return true
    if (checkIfFileExists(filePath)) {
      return filePath;
    }
    // get and save attachment
    const attachmentData = await gmail.users.messages.attachments.get({
      userId: "me",
      messageId: messageId,
      id: attachmentId,
    });
    const attachmentBytes = decodeBase64(attachmentData.data["data"]);
    fs.writeFileSync(filePath, attachmentBytes);
    return filePath; // Return the saved file path
  } catch (error) {
    console.error("Error saving email attachment: ", error);
    return null;
  }
}

async function saveEmailAttachment(
  gmail,
  messageId,
  attachmentId,
  mcomm_type,
  mtwitter,
) {
  try {
    // Define the image path with a proper file extension
    const imagePath = `./images/${mcomm_type}_${mtwitter}.png`;

    // Check if the file exists
    if (!checkIfFileExists(imagePath)) {
      // Fetch attachment data from Gmail
      const attachmentData = await gmail.users.messages.attachments.get({
        userId: "me",
        messageId: messageId,
        id: attachmentId,
      });

      // Decode the Base64 string
      const attachmentBytes = decodeBase64(attachmentData.data["data"]);

      // Write to disk
      await fs.writeFile(imagePath, attachmentBytes);
      console.log(`Image saved at: ${imagePath}`);
    }
    return imagePath; // Return the path to the saved image
  } catch (error) {
    console.error("Error saving email attachment:", error);
    return null;
  }
}

function checkIfFileExists(directoryPath) {
  try {
    fs.accessSync(directoryPath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function decodeBase64(data) {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  const decoded = atob(base64);
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    bytes[i] = decoded.charCodeAt(i);
  }
  return bytes;
}

function getAttachmentIds(parts) {
  const attachmentIds = [];

  function processParts(partsArray) {
    partsArray.forEach((part) => {
      if (part.body && part.body.attachmentId) {
        attachmentIds.push({
          filename: part.filename,
          attachmentId: part.body.attachmentId,
        });
      } else if (part.parts) {
        processParts(part.parts);
      }
    });
  }

  if (parts) {
    processParts(parts);
  }
  return attachmentIds[0]["attachmentId"];
}

// Run fetchEmails function AFTER autherization
authorize().then(fetchEmails).catch(console.error);

async function startFetchingEmails() {
  const auth = await authorize();
  await fetchEmails(auth);
}
module.exports = { startFetchingEmails };
