const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

// Find credentials file
function findFilePath(fileName) {
  const possiblePaths = [
    path.join(__dirname, fileName),
    path.join(process.cwd(), "src/API", fileName),
    path.join(process.resourcesPath || "", "src/API", fileName),
  ];

  for (const testPath of possiblePaths) {
    try {
      if (fs.existsSync(testPath)) {
        return testPath;
      }
    } catch (err) {
      // Skip inaccessible paths
    }
  }

  return null;
}

// Find images directory
function findImagesDirectory() {
  const possibleDirs = [
    path.join(__dirname, "images"),
    path.join(process.cwd(), "src/API/images"),
    path.join(process.cwd(), "images"),
    path.join(__dirname, "../images"),
  ];

  for (const dirPath of possibleDirs) {
    try {
      if (fs.existsSync(dirPath)) {
        return dirPath;
      }
    } catch (err) {
      // Skip inaccessible paths
    }
  }

  // Create default directory if not found
  const defaultDir = path.join(process.cwd(), "src/API/images");
  try {
    if (!fs.existsSync(defaultDir)) {
      fs.mkdirSync(defaultDir, { recursive: true });
    }
  } catch (err) {
    console.error(`Error creating directory: ${err.message}`);
  }

  return defaultDir;
}

// Initialize Firebase and Google services
let db = null;
let gmail = null;

try {
  const serviceAccountPath = findFilePath(
    "commissions-app-c6e2c-firebase-adminsdk-fbsvc-473cacb7d7.json",
  );
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
  }

  db = admin.firestore();

  // Initialize Google API client
  const creds = require(credsPath);
  const oauth2Client = new google.auth.OAuth2(
    creds.installed.client_id,
    creds.installed.client_secret,
    creds.installed.redirect_uris[0],
  );

  // Load token
  const tokenPath = findFilePath("token.json");
  if (tokenPath) {
    const token = JSON.parse(fs.readFileSync(tokenPath, "utf8"));
    oauth2Client.setCredentials(token);
  } else {
    // Fallback to hardcoded refresh token
    oauth2Client.setCredentials({
      refresh_token:
        "1//01g_UpXftDSLWCgYIARAAGAESNwF-L9IrhjQ0bAG-jmjCZOVHHCjrrHVoJHXzgsV2G0eSfXt2yJfrIjRUiRQfmaKNa_zxfqlnAZQ",
    });
  }

  gmail = google.gmail({ version: "v1", auth: oauth2Client });
} catch (error) {
  console.error("Error initializing services:", error);
}

// Function to download attachment from Gmail API
// The key fix is in this function - proper base64 decoding
const downloadAttachmentFromGmail = async (attachmentId, messageId) => {
  if (!gmail) {
    throw new Error("Gmail API client not initialized");
  }

  try {
    console.log(`Downloading attachment from message ${messageId}`);

    // Fetch attachment from Gmail API
    const attachmentData = await gmail.users.messages.attachments.get({
      userId: "me",
      messageId: messageId,
      id: attachmentId,
    });

    if (!attachmentData.data || !attachmentData.data.data) {
      throw new Error("No data in attachment response");
    }

    // Decode the Base64 string with proper character replacement
    // This is the key fix that matches how script.js does it
    const base64Data = attachmentData.data.data
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    // Convert to binary buffer
    const binaryData = Buffer.from(base64Data, "base64");
    console.log(`Decoded image data, size: ${binaryData.length} bytes`);

    return binaryData;
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
      return { success: true, message: "No documents found to process" };
    }

    // Find the correct images directory
    const imagesDir = findImagesDirectory();

    // Make sure directory exists
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    // Process each document
    let processed = 0;
    let skipped = 0;
    let failed = 0;
    let results = [];

    for (const doc of snapshot.docs) {
      const ID = doc.id;
      const data = doc.data();
      const attachmentId = data.IMG1;
      const messageId = data.MSG_ID;

      console.log(`Processing document: ${ID}`);

      if (!attachmentId || !messageId) {
        console.log(
          `Skipping document ${ID}, missing attachmentId or messageId.`,
        );
        skipped++;
        continue;
      }

      // Use the ID as the filename
      const imagePath = path.join(imagesDir, `${ID}.png`);

      // Skip if image already exists
      if (fs.existsSync(imagePath)) {
        console.log(`Image ${ID} already exists, skipping.`);
        skipped++;
        continue;
      }

      try {
        console.log(`Downloading image for ${ID}...`);

        // Download the attachment with timeout protection
        const downloadPromise = downloadAttachmentFromGmail(
          attachmentId,
          messageId,
        );
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Download timed out")), 60000),
        );

        const imageBuffer = await Promise.race([
          downloadPromise,
          timeoutPromise,
        ]);

        if (!imageBuffer || imageBuffer.length === 0) {
          throw new Error("Downloaded image is empty");
        }

        // Save the image
        await fs.promises.writeFile(imagePath, imageBuffer);
        console.log(`Image ${ID} saved successfully to ${imagePath}`);

        processed++;
        results.push({
          id: ID,
          status: "processed",
          path: imagePath,
        });
      } catch (error) {
        console.error(`Error processing image ${ID}:`, error);
        failed++;
        results.push({
          id: ID,
          status: "failed",
          error: error.message,
        });
      }
    }

    return {
      success: true,
      message: `Processed ${processed} images, skipped ${skipped}, failed ${failed}`,
      processed,
      skipped,
      failed,
      results,
    };
  } catch (error) {
    console.error("Error in checkAndSaveImages:", error);
    return {
      success: false,
      message: error.message,
    };
  }
};

// Export functions and objects for use in server.js
module.exports = checkAndSaveImages;
module.exports.downloadAttachmentFromGmail = downloadAttachmentFromGmail;
module.exports.findImagesDirectory = findImagesDirectory;
module.exports.db = db;
module.exports.gmail = gmail;
