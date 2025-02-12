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

        // Try setting the data
        await docRef.set({
            ID: emailId,
            NAME: "",
            Date_Commission_Type_Start: "",
            Paydue_Day_Commission_Payment_Due: "",
            Due_Date_Commission: "",
            Twitter: "",
            Commission_Type: "",
            Email: emailData.from,  // Sender's email
            Paypal_Email: "",
            Img1: "",  // Add file handling if needed later
            Img2: "",
            Notes: "",
            Complete: false,
            In_Archive: false,
            Paid: false,
            Complex: false,
            Email_Pay: false,
            Email_Comp: false,
            Email_Commpay: false,
            Email_Wip: false
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
            maxResults: 20,                               //Limit 10 emails
            labelIds: ['INBOX'],                          // Only fetch emails from indox
            // Add Queries like 'is:unread' 'subject:TWITCH ALERTS' 'from:specific_email@example.com' 
            q: 'is:unread (subject:"twitch alerts" OR subject:"VALENTINES COMMISSION" OR subject:"new commission")'

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
            await markEmailAsRead(auth, messageId);

            const msg = await gmail.users.messages.get({
                userId: 'me',
                id: message.id,

            });

            // Get Objects from email 
            const subjectHeader = msg.data.payload.headers.find(header => header.name === 'Subject');
            const fromHeader = msg.data.payload.headers.find(header => header.name === 'From');
            const dateHeader = msg.data.payload.headers.find(header => header.name === 'Date');

            // Convert into Strings with .value to retrieve the value from the object
            const subject = subjectHeader ? subjectHeader.value : "(No subject)";
            const from = fromHeader ? fromHeader.value : '(No Sender)';
            const date = dateHeader ? dateHeader.value : '(No Date)';

            // Print the strings, eventually send to Datebase
            console.log(`From ${from}`);
            console.log(`Subject: ${subject}`);
            console.log(`Date: ${date}`);

            console.log("--------------------------");

            // Store in Firebase
            await storeEmailInFirebase({ from, subject });
        }
        // Catch err if any
    } catch (err) {
        console.error("The API returned an error: " + err);
    }
}

// Run fetchEmails function AFTER autherization
authorize().then(fetchEmails).catch(console.error);

