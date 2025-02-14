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

const SCOPES = ["https://www.googleapis.com/auth/gmail.send"];
const TOKEN_PATH = path.join(process.cwd(), "token.json");
const CREDENTIALS_PATH = path.join(process.cwd(), "credentials.json");

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
 * Load or request authorization to call APIs.
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
 * Sends an email using the Gmail API.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
async function sendEmail(auth) {
  const gmail = google.gmail({ version: "v1", auth });

  const email = [
    "From: me",
    "To: joshiqua@gmail.com",
    "Subject: Test Email from My App",
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    "Hi, this is a test from my APPPPP!",
  ].join("\n");

  const encodedMessage = Buffer.from(email)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  try {
    const response = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedMessage,
      },
    });

    console.log("Email sent successfully:", response.data);
  } catch (error) {
    console.error("Error sending email:", error);
  }
}

// Run the script
authorize().then(sendEmail).catch(console.error);
