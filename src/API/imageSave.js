const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");
const { google } = require("googleapis");
const serviceAccount = require("./commissions-app-c6e2c-firebase-adminsdk-fbsvc-473cacb7d7.json");
const creds = require("./credentials.json");

// Ensure Firebase is only initialized once
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://commissions-app-c6e2c.firebaseio.com",
  });
}

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
  return Buffer.from(base64, "base64");
}

// Function to download the attachment from Gmail API
const downloadAttachmentFromGmail = async (attachmentId, messageId) => {
  try {
    const res = await gmail.users.messages.attachments.get({
      userId: "me",
      messageId: messageId,
      id: attachmentId,
    });
    return Buffer.from(res.data.data, "base64");
  } catch (error) {
    console.error("Error downloading attachment:", error);
    throw error;
  }
};

const checkAndSaveImages = async () => {
  try {
    const snapshot = await db.collection("commissions").get();

    if (snapshot.empty) {
      console.log("No documents found.");
      return;
    }

    const imagesDir = path.join(__dirname, "./images");
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir);
    }

    for (const doc of snapshot.docs) {
      const ID = doc.id;
      const attachmentId = doc.data().IMG1;
      const messageId = doc.data().MSG_ID;

      if (!attachmentId || !messageId) {
        console.log(
          `Skipping document ${ID}, missing attachmentId or messageId.`,
        );
        continue;
      }

      const imagePath = path.join(imagesDir, `${ID}.png`);
      if (fs.existsSync(imagePath)) {
        console.log(`Image ${ID} already exists.`);
        continue;
      }

      try {
        const imageBuffer = await downloadAttachmentFromGmail(
          attachmentId,
          messageId,
        );
        await fs.promises.writeFile(imagePath, imageBuffer);
        console.log(`Image ${ID} saved.`);
      } catch (error) {
        console.error(`Error processing image ${ID}:`, error);
      }
    }
  } catch (error) {
    console.error("Error in checkAndSaveImages:", error);
  }
};

module.exports = checkAndSaveImages;
