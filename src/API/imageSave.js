const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");
const { google } = require("googleapis");
const serviceAccount = require("./commissions-app-c6e2c-firebase-adminsdk-fbsvc-473cacb7d7.json");

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://commissions-app-c6e2c.firebaseio.com",
});

const db = admin.firestore();

const oauth2Client = new google.auth.OAuth2(
  "955143852179-92l473phhormjfscrj4o7ss7nsvkldj9.apps.googleusercontent.com", // client_id
  "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", // client_secret
  "https://accounts.google.com/o/oauth2/auth", // redirect_uri (use your app's redirect URI if needed)
);

// Set credentials using your refresh_token
oauth2Client.setCredentials({
  refresh_token:
    "1//01g_UpXftDSLWCgYIARAAGAESNwF-L9IrhjQ0bAG-jmjCZOVHHCjrrHVoJHXzgsV2G0eSfXt2yJfrIjRUiRQfmaKNa_zxfqlnAZQ",
});

const gmail = google.gmail({ version: "v1", auth: oauth2Client });

// Decode base64 image data
function decodeBase64(data) {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  const decoded = atob(base64);
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    bytes[i] = decoded.charCodeAt(i);
  }
  return bytes;
}

// Function to download the attachment from Gmail API
const downloadAttachmentFromGmail = async (attachmentId, messageId) => {
  try {
    const res = await gmail.users.messages.attachments.get({
      userId: "me",
      messageId: messageId,
      id: attachmentId,
    });
    const attachmentData = res.data.data;
    const buffer = Buffer.from(attachmentData, "base64");
    return buffer;
  } catch (error) {
    console.error("Error downloading attachment:", error);
    throw error;
  }
};
const checkAndSaveImages = async () => {
  try {
    // Fetch all documents from the 'commissions' collection in Firestore
    const snapshot = await db.collection("commissions").get();

    if (snapshot.empty) {
      console.log("No documents found.");
      return;
    }

    // Ensure the images directory exists
    const imagesDir = path.join(__dirname, "./images");
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir); // Create the directory if it doesn't exist
    }

    // Loop through each document in the 'commissions' collection
    for (const doc of snapshot.docs) {
      const ID = doc.id; // Get document ID (used as the image filename)
      const attachmentId = doc.data().IMG1; // Get the attachment ID (stored in Firestore)
      const messageId = doc.data().MSG_ID; // Get the message ID (stored in Firestore)

      if (!attachmentId || !messageId) {
        console.log(`Missing attachmentId or messageId for document ID: ${ID}`);
        continue; // Skip if no attachment ID or message ID is available
      }

      console.log(
        `Document ID: ${ID}, messageId: ${messageId}, attachmentId: ${attachmentId}`,
      );

      const imagePath = path.join(imagesDir, `${ID}.png`);

      // Check if the image already exists in the local directory
      if (fs.existsSync(imagePath)) {
        console.log(`Image with ID ${ID} already exists at ${imagePath}`);
      } else {
        try {
          // Download the attachment from Gmail
          const imageBuffer = await downloadAttachmentFromGmail(
            attachmentId,
            messageId,
          );

          // Save the image locally
          await fs.promises.writeFile(imagePath, imageBuffer); // Write the buffer to the file asynchronously
          console.log(`Image with ID ${ID} saved at ${imagePath}`);
        } catch (error) {
          console.error("Error downloading or saving image:", error);
        }
      }
    }
  } catch (error) {
    console.error("Error in checkAndSaveImages:", error);
  }
};

module.exports = checkAndSaveImages;
