const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

// More robust path finding
function findFilePath(fileName) {
  const possiblePaths = [
    path.join(__dirname, fileName),
    path.join(process.cwd(), 'src/API', fileName),
    path.join(process.resourcesPath || '', 'src/API', fileName)
  ];

  for (const testPath of possiblePaths) {
    try {
      if (fs.existsSync(testPath)) {
        console.log(`Found ${fileName} at: ${testPath}`);
        return testPath;
      }
    } catch (err) {
      // Ignore errors
    }
  }

  console.error(`Could not find ${fileName} in any expected location`);
  return null;
}

// Initialize Firebase and Google services with better error handling
let db = null;
let gmail = null;

try {
  // Find credential files
  const serviceAccountPath = findFilePath("commissions-app-c6e2c-firebase-adminsdk-fbsvc-473cacb7d7.json");
  const credsPath = findFilePath("credentials.json");

  if (!serviceAccountPath || !credsPath) {
    throw new Error("Could not find credential files");
  }

  // Initialize Firebase
  const admin = require("firebase-admin");
  const serviceAccount = require(serviceAccountPath);

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: "https://commissions-app-c6e2c.firebaseio.com",
    });
    console.log("Firebase initialized successfully");
  }

  db = admin.firestore();

  // Initialize Google API client
  const creds = require(credsPath);
  const oauth2Client = new google.auth.OAuth2(
    creds.installed.client_id,
    creds.installed.client_secret,
    creds.installed.redirect_uris[0]
  );

  // Look for token file
  const tokenPath = findFilePath("token.json");
  if (tokenPath) {
    const token = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    oauth2Client.setCredentials(token);
  } else {
    // Fallback to hardcoded refresh token (not recommended for production)
    oauth2Client.setCredentials({
      refresh_token: "1//01g_UpXftDSLWCgYIARAAGAESNwF-L9IrhjQ0bAG-jmjCZOVHHCjrrHVoJHXzgsV2G0eSfXt2yJfrIjRUiRQfmaKNa_zxfqlnAZQ"
    });
  }

  gmail = google.gmail({ version: "v1", auth: oauth2Client });
  console.log("Gmail API client initialized successfully");

} catch (error) {
  console.error("Error initializing services:", error);
}

// Function to download the attachment from Gmail API
const downloadAttachmentFromGmail = async (attachmentId, messageId) => {
  if (!gmail) {
    throw new Error("Gmail API client not initialized");
  }

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

// Main function to check and save images
const checkAndSaveImages = async () => {
  if (!db || !gmail) {
    console.error("Services not initialized properly");
    return { success: false, message: "Services not initialized properly" };
  }

  try {
    console.log("Starting checkAndSaveImages...");

    // Get documents from Firestore
    const snapshot = await db.collection("commissions").get();
    if (snapshot.empty) {
      console.log("No documents found in Firestore.");
      return { success: true, message: "No documents found to process" };
    }

    // Ensure images directory exists
    const imagesDir = path.join(__dirname, "images");
    try {
      if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
        console.log(`Created images directory at ${imagesDir}`);
      }
    } catch (dirErr) {
      console.error("Error creating images directory:", dirErr);
    }

    // Process each document
    let processed = 0;
    let skipped = 0;
    let failed = 0;

    for (const doc of snapshot.docs) {
      const ID = doc.id;
      const data = doc.data();
      const attachmentId = data.IMG1;
      const messageId = data.MSG_ID;

      if (!attachmentId || !messageId) {
        console.log(`Skipping document ${ID}, missing attachmentId or messageId.`);
        skipped++;
        continue;
      }

      const imagePath = path.join(imagesDir, `${ID}.png`);

      if (fs.existsSync(imagePath)) {
        console.log(`Image ${ID} already exists, skipping.`);
        skipped++;
        continue;
      }

      try {
        console.log(`Downloading image for ${ID}...`);
        const imageBuffer = await downloadAttachmentFromGmail(attachmentId, messageId);

        await fs.promises.writeFile(imagePath, imageBuffer);
        console.log(`Image ${ID} saved successfully.`);
        processed++;
      } catch (error) {
        console.error(`Error processing image ${ID}:`, error);
        failed++;
      }
    }

    return {
      success: true,
      message: `Processed ${processed} images, skipped ${skipped}, failed ${failed}`
    };
  } catch (error) {
    console.error("Error in checkAndSaveImages:", error);
    return {
      success: false,
      message: error.message
    };
  }
};

module.exports = checkAndSaveImages;