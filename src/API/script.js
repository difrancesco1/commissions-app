const fs = require("fs").promises;
const path = require("path");
const process = require("process");
const { authenticate } = require("@google-cloud/local-auth");
const { google } = require("googleapis");

// Firebase setup with better error handling
let admin;
let db;

try {
  admin = require("firebase-admin");
  console.log("Firebase admin loaded successfully");

  // Try to find the service account file with robust path handling
  let serviceAccountPath;
  const possiblePaths = [
    path.join(__dirname, "commissions-app-c6e2c-firebase-adminsdk-fbsvc-473cacb7d7.json"),
    path.join(process.cwd(), "src/API/commissions-app-c6e2c-firebase-adminsdk-fbsvc-473cacb7d7.json"),
    path.join(process.resourcesPath || "", "src/API/commissions-app-c6e2c-firebase-adminsdk-fbsvc-473cacb7d7.json")
  ];

  for (const testPath of possiblePaths) {
    try {
      if (require('fs').existsSync(testPath)) {
        serviceAccountPath = testPath;
        console.log(`Found service account at: ${serviceAccountPath}`);
        break;
      }
    } catch (err) {
      console.log(`Error checking path ${testPath}: ${err.message}`);
    }
  }

  if (!serviceAccountPath) {
    throw new Error("Service account file not found");
  }

  const serviceAccount = require(serviceAccountPath);

  // Check if Firebase app is already initialized
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: "https://commissions-app-c6e2c.firebaseio.com",
    });
    console.log("Firebase app initialized successfully");
  } else {
    console.log("Firebase app was already initialized");
  }

  db = admin.firestore(); // Using Firestore as the database
  console.log("Firestore initialized successfully");
} catch (error) {
  console.error("Firebase initialization error:", error);
  // Create a mock Firestore implementation
  db = {
    collection: (name) => ({
      doc: (id) => ({
        set: async (data) => {
          console.log(`Mock Firestore: Would save to ${name}/${id}:`, data);
          return { id };
        },
        get: async () => ({
          exists: false,
          data: () => null
        })
      })
    })
  };
  console.log("Using mock Firestore implementation");
}

const SCOPES = ["https://www.googleapis.com/auth/gmail.modify"];

// Robust path handling for token and credentials files
function getTokenPath() {
  const possiblePaths = [
    path.join(__dirname, "token.json"),
    path.join(process.cwd(), "src/API/token.json"),
    path.join(process.resourcesPath || "", "src/API/token.json")
  ];

  for (const testPath of possiblePaths) {
    try {
      if (require('fs').existsSync(testPath)) {
        console.log(`Found token.json at: ${testPath}`);
        return testPath;
      }
    } catch (err) {
      // Ignore errors
    }
  }

  // Default to a writable location
  return path.join(__dirname, "token.json");
}

function getCredentialsPath() {
  const possiblePaths = [
    path.join(__dirname, "credentials.json"),
    path.join(process.cwd(), "src/API/credentials.json"),
    path.join(process.resourcesPath || "", "src/API/credentials.json")
  ];

  for (const testPath of possiblePaths) {
    try {
      if (require('fs').existsSync(testPath)) {
        console.log(`Found credentials.json at: ${testPath}`);
        return testPath;
      }
    } catch (err) {
      // Ignore errors
    }
  }

  return path.join(__dirname, "credentials.json");
}

const TOKEN_PATH = getTokenPath();
const CREDENTIALS_PATH = getCredentialsPath();

console.log(`Using TOKEN_PATH: ${TOKEN_PATH}`);
console.log(`Using CREDENTIALS_PATH: ${CREDENTIALS_PATH}`);

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    console.log("Loaded saved credentials");
    return google.auth.fromJSON(credentials);
  } catch (err) {
    console.log(`Error loading saved credentials: ${err.message}`);
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
  try {
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
    console.log(`Credentials saved to ${TOKEN_PATH}`);
  } catch (err) {
    console.error(`Error saving credentials: ${err.message}`);
    throw err;
  }
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
  try {
    console.log("Attempting to authorize...");
    let client = await loadSavedCredentialsIfExist();
    if (client) {
      console.log("Using existing credentials");
      return client;
    }

    console.log("No existing credentials found, starting new authentication flow");
    // Check if credentials exist before authenticating
    try {
      await fs.access(CREDENTIALS_PATH);
    } catch (err) {
      console.error(`Error accessing credentials file: ${err.message}`);
      throw new Error(`Credentials file not found at ${CREDENTIALS_PATH}`);
    }

    client = await authenticate({
      scopes: SCOPES,
      keyfilePath: CREDENTIALS_PATH,
    });

    if (client.credentials) {
      await saveCredentials(client);
    }
    return client;
  } catch (err) {
    console.error(`Authorization error: ${err.message}`);
    throw err;
  }
}

let emailId = 0; // Initialize ID counter

// store in DB with better error handling
async function storeEmailInFirebase(emailData) {
  try {
    console.log(`Storing email data for ${emailData.mtwitter} in Firebase...`);

    const commissionDueDateRef = db.collection("commissionDueDate");
    // Generates a document ID
    const docRef = db
      .collection("commissions")
      .doc(emailData["mcomm_type"] + emailData["mtwitter"]);

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
    return true;
  } catch (error) {
    console.error("Error storing email in Firebase:", error);
    return false;
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
    return true;
  } catch (error) {
    console.log(`Error marking email ${messageId} as read: ${error}`);
    return false;
  }
}

// Main function to fetch emails with better error handling
async function fetchEmails(auth) {
  console.log("Starting to fetch emails...");

  try {
    const gmail = google.gmail({ version: "v1", auth });

    // prevent duplicates -> sent side by side usually
    const commsInDatabase = [];
    const failedEmailNames = [];
    const emailReq = 'is:unread (subject:"- DO NOT OPEN -")';

    console.log(`Querying Gmail with: ${emailReq}`);

    // List the latest 10 emails fetched
    const res = await gmail.users.messages.list({
      userId: "me",
      labelIds: ["INBOX"], // Only fetch emails from inbox
      q: emailReq,
    });

    // If there are no new emails exit loop
    const messages = res.data.messages;
    if (!messages || messages.length === 0) {
      console.log("No new emails matching query");
      return {
        success: true,
        message: "No new emails to process",
        count: 0
      };
    }

    console.log(`Found ${messages.length} new emails to process`);
    let processedCount = 0;

    // Fetch details of each email
    for (const message of messages) {
      const messageId = message.id;
      console.log(`Processing email ID: ${messageId}`);

      try {
        const msg = await gmail.users.messages.get({
          userId: "me",
          id: messageId,
          format: "full",
        });

        // Extract email data with error handling
        // sort through message body
        const msgBody = Buffer.from(
          msg.data.payload.parts[0].body.data
            .replace(/-/g, "+")
            .replace(/_/g, "/"),
          'base64'
        ).toString('utf8').split("\r\n");

        const memail = msgBody[11];
        if (commsInDatabase.includes(memail.toLowerCase())) {
          console.log(`Skipping duplicate email: ${memail}`);
          continue;
        }
        commsInDatabase.push(memail.toLowerCase());

        const mname = msgBody[7].split(" ")[0]; // only save the first part of the name
        const msgDate = msgBody[1].split("/");
        const mdate = new Date(msgDate[2], msgDate[0] - 1, msgDate[1]); // -1 because months begin with 0
        const mcomm_type = msgBody[3];
        const mcomm_name = msgBody[5];
        let mtwitter = msgBody[9];

        // scrape data to only include username
        if (mtwitter.includes("/")) {
          mtwitter = mtwitter.split("/").pop();
        } else if (mtwitter.includes("@")) {
          mtwitter = mtwitter.split("@").pop();
        }
        const mpaypal = msgBody[13];
        const mcomplex = msgBody[15];

        console.log(`Parsed email data for ${mtwitter} (${mcomm_type})`);

        // Get attachment with fallback
        let attachmentId = null;
        try {
          attachmentId = getAttachmentIds(msg.data.payload.parts);
          await saveEmailAttachment(
            gmail,
            messageId,
            attachmentId,
            mcomm_type,
            mtwitter,
          );
        } catch (err) {
          console.error(`Error handling attachment: ${err.message}`);
          // Continue even if attachment fails
        }

        // Store in Firebase
        const storeResult = await storeEmailInFirebase({
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

        if (storeResult) {
          // mark as read when all is successful
          await markEmailAsRead(auth, messageId);
          processedCount++;
        }
      } catch (err) {
        console.error(`Error processing email ${messageId}: ${err.message}`);
        try {
          const subjectHeader = msg.data.payload.headers.find(
            (header) => header.name === "Subject",
          );
          const dateHeader = msg.data.payload.headers.find(
            (header) => header.name === "Date",
          );
          failedEmailNames.push(
            dateHeader?.value +
            ": " +
            subjectHeader?.value +
            "(" +
            messageId +
            ")" +
            " " +
            err.message,
          );
        } catch (headerErr) {
          failedEmailNames.push(`Error processing email ${messageId}: ${err.message}`);
        }
      }
    }

    if (failedEmailNames.length > 0) {
      console.log("Failed emails:", failedEmailNames);
    }

    return {
      success: true,
      message: `Processed ${processedCount} emails`,
      count: processedCount,
      failed: failedEmailNames.length,
      failedDetails: failedEmailNames
    };
  } catch (err) {
    console.error("The API returned an error:", err);
    return {
      success: false,
      error: err.message
    };
  }
}

// Image handling with better filesystem error handling
async function saveEmailAttachment(
  gmail,
  messageId,
  attachmentId,
  mcomm_type,
  mtwitter,
) {
  try {
    // Ensure the images directory exists
    const imagesDir = path.join(__dirname, "images");
    try {
      await fs.mkdir(imagesDir, { recursive: true });
    } catch (dirErr) {
      console.log(`Note: images directory already exists or couldn't be created: ${dirErr.message}`);
    }

    // Define the image path with a proper file extension
    const imagePath = path.join(__dirname, "images", `A03${mtwitter}.png`);

    // Check if the file exists
    let fileExists = false;
    try {
      await fs.access(imagePath);
      fileExists = true;
    } catch (err) {
      fileExists = false;
    }

    if (!fileExists) {
      // Fetch attachment data from Gmail
      const attachmentData = await gmail.users.messages.attachments.get({
        userId: "me",
        messageId: messageId,
        id: attachmentId,
      });

      // Decode the Base64 string
      const base64Data = attachmentData.data.data
        .replace(/-/g, "+")
        .replace(/_/g, "/");

      const binaryData = Buffer.from(base64Data, 'base64');

      // Write to disk
      await fs.writeFile(imagePath, binaryData);
      console.log(`Image saved at: ${imagePath}`);
    } else {
      console.log(`Image already exists at: ${imagePath}`);
    }

    return imagePath; // Return the path to the saved image
  } catch (error) {
    console.error("Error saving email attachment:", error);
    return null;
  }
}

function getAttachmentIds(parts) {
  if (!parts) {
    throw new Error("No message parts found");
  }

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

  processParts(parts);

  if (attachmentIds.length === 0) {
    throw new Error("No attachments found in email");
  }

  return attachmentIds[0].attachmentId;
}

// Main exported function with timeout and error handling
async function startFetchingEmails() {
  console.log("startFetchingEmails called");

  // Create a timeout promise
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Email fetching timed out after 30 seconds")), 30000)
  );

  try {
    // Race the authorization and email fetch against the timeout
    const result = await Promise.race([
      (async () => {
        const auth = await authorize();
        return await fetchEmails(auth);
      })(),
      timeout
    ]);

    console.log("Email fetching completed successfully:", result);
    return result;
  } catch (error) {
    console.error("Error in startFetchingEmails:", error);
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}

// Export the main function
module.exports = { startFetchingEmails };