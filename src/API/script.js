const fs = require('fs').promises;
const path = require('path');
const process = require('process');
const { authenticate } = require('@google-cloud/local-auth');
const { google } = require('googleapis');

const admin = require('firebase-admin');
const serviceAccount = require('./commissions-app-c6e2c-firebase-adminsdk-fbsvc-473cacb7d7.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://commissions-app-c6e2c.firebaseio.com'
});

const db = admin.firestore();  // Using Firestore as the database

const SCOPES = ['https://www.googleapis.com/auth/gmail.modify'];
// // The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

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
        type: 'authorized_user',
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

let emailId = 0;  // Initialize ID counter

// store in DB
async function storeEmailInFirebase(emailData) {
    try {
        const docRef = db.collection('commissions').doc(emailId.toString());

        // Log document reference to ensure it's correct
        console.log("Document Reference: ", docRef.path);

        // // calculate due date - date on form + 7 + emailid
        // var dueDate = new Date(emailData["mdate"]);
        // dueDate.setDate(dueDate.getDate() + emailId + 7);

        // calculate paydue (msgdate + 30 days)
        var payDue = new Date(); // Now
        payDue.setDate(payDue.getDate() + 30);

        // Try setting the data
        await docRef.set({
            ID: emailId,
            NAME: emailData["mname"],
            COMM_START_DATE: emailData["mdate"], // when the first commission is to start
            PAYDUE: payDue, // when the payment is due -> move to archive after 30 days
            DUE: "", // set after someone pays - logic is +1 whoever is in queue , first person is +7 of comm_start_date
            TWITTER: emailData["mtwitter"],
            COMM_TYPE: emailData["mcomm_type"], // commission type (A02) -> alerts from febuary
            COMM_NAME: emailData["mcomm_name"], // full name of commission
            EMAIL: emailData["memail"],  // email to send commission
            PAYPAL: emailData["mpaypal"], // paypal email
            IMG1: "",  // Add file handling if needed later
            IMG2: "",
            NOTES: "click to add short note :3", // empty for now
            COMPLETE: false,
            ARCHIVE: false, // if true, is archived
            PAID: false, 
            COMPLEX: (emailData["mcomplex"] === 'true'), // set true depending on email data
            EMAIL_PAY: false,
            EMAIL_COMP: false,
            EMAIL_COMPPAY: false,
            EMAIL_WIP: false
        });

        console.log(`Email with ID ${emailId} stored in Firebase.`);
        emailId++;  // Increment ID for the next email
    } catch (error) {
        console.error("Error storing email in Firebase:", error);
    }
}



async function markEmailAsRead(auth, messageId) {
    const gmail = google.gmail({ version: 'v1', auth });

    try {
        // Remove the unread label and mark as read
        await gmail.users.messages.modify({
            userId: 'me',
            id: messageId,
            resource: {
                removeLabelIds: ['UNREAD'],
            },
        });
        console.log(`Email ${messageId} has been marked as read`);
    } catch (error) {
        console.log(`Error marking email ${messageId} as read: ${error}`);
    }
}

async function fetchEmails(auth) {
    const gmail = google.gmail({ version: 'v1', auth });

    try {
        // List the latest 10 emails fetched
        const res = await gmail.users.messages.list({
            userId: 'me',
            maxResults: 10,                             //Limit 10 emails
            labelIds: ['INBOX'],                          // Only fetch emails from indox
            // Add Queries like 'is:unread' 'subject:TWITCH ALERTS' 'from:specific_email@example.com' 
            q: 'is:unread (subject:"twitch alerts" OR subject:"new commission")'

        });

        // If there are no new emails exit loop
        const messages = res.data.messages;
        if (!messages || messages.length === 0) {
            console.log("no new emails");
            return;
        }

        console.log("Fetching the latest 10 emails...\n");

        // Fetch details of each email
        for (const message of messages) {

            const messageId = message.id;
            // await markEmailAsRead(auth, messageId);

            const msg = await gmail.users.messages.get({
                userId: 'me',
                id: message.id,
            });

            // sort through message body
            const msgBody = atob(msg.data.payload.parts[0].body.data.replace(/-/g, '+').replace(/_/g, '/')).split("\r\n");
            const msgDate = msgBody[1].split("/");
            const mdate = new Date(msgDate[2],msgDate[0]-1,msgDate[1]); // -1 because months begin with 0 
            const mcomm_type = msgBody[3];
            const mcomm_name = msgBody[5];
            const mname = msgBody[7];
            const mtwitter = msgBody[9];
            const memail = msgBody[11];
            const mpaypal = msgBody[13];
            const mcomplex = msgBody[15];

            // Print the strings, eventually send to Datebase
            console.log(`Date: ${mdate}`);
            console.log(`${mtwitter}`);
            console.log("--------------------------");

            // Store in Firebase
            await storeEmailInFirebase({ mdate, mcomm_type, mcomm_name, mname, mtwitter, memail, mpaypal, mcomplex });
        }
        // Catch err if any
    } catch (err) {
        console.error("The API returned an error: " + err);
    }
}

// Run fetchEmails function AFTER autherization
authorize().then(fetchEmails).catch(console.error);

