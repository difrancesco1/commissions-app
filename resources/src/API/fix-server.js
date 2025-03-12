const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const { google } = require("googleapis");

// Firebase setup
let admin;
let db;
try {
  admin = require("firebase-admin");
  console.log("Firebase admin loaded successfully");

  // Try to find the service account file
  let serviceAccountPath;
  const possiblePaths = [
    path.join(
      __dirname,
      "commissions-app-c6e2c-firebase-adminsdk-fbsvc-473cacb7d7.json",
    ),
    path.join(
      process.cwd(),
      "src/API/commissions-app-c6e2c-firebase-adminsdk-fbsvc-473cacb7d7.json",
    ),
    path.join(
      process.resourcesPath || "",
      "src/API/commissions-app-c6e2c-firebase-adminsdk-fbsvc-473cacb7d7.json",
    ),
  ];

  for (const testPath of possiblePaths) {
    try {
      if (fs.existsSync(testPath)) {
        serviceAccountPath = testPath;
        console.log(`Found service account at: ${serviceAccountPath}`);
        break;
      }
    } catch (err) {
      // Skip inaccessible paths
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
  // Create a mock Firestore implementation for testing
  db = {
    collection: (name) => ({
      doc: (id) => ({
        set: async (data) => {
          console.log(`Mock Firestore: Would save to ${name}/${id}:`, data);
          return { id };
        },
        get: async () => ({
          exists: false,
          data: () => null,
        }),
      }),
      where: () => ({
        get: async () => ({
          empty: true,
          docs: [],
        }),
      }),
    }),
  };
  console.log("Using mock Firestore implementation");
}

// Create the Express app
const app = express();
const port = 5000;

// Enable CORS
app.use(cors());

// Utility functions for finding paths
function findFilePath(fileName, additionalPaths = []) {
  const possiblePaths = [
    path.join(__dirname, fileName),
    path.join(process.cwd(), "src/API", fileName),
    path.join(process.resourcesPath || "", "src/API", fileName),
    ...additionalPaths,
  ];

  for (const testPath of possiblePaths) {
    try {
      if (fs.existsSync(testPath)) {
        console.log(`Found file at: ${testPath}`);
        return testPath;
      }
    } catch (err) {
      // Skip inaccessible paths
    }
  }

  console.error(`File not found: ${fileName}`);
  return null;
}

function ensureImagesDir() {
  const imagesDir = path.join(__dirname, "images");

  if (!fs.existsSync(imagesDir)) {
    try {
      fs.mkdirSync(imagesDir, { recursive: true });
      console.log(`Created images directory at: ${imagesDir}`);
    } catch (err) {
      console.error(`Failed to create images directory: ${err.message}`);
    }
  }

  return imagesDir;
}

// Create placeholder image function
function createPlaceholderImage(imagePath) {
  try {
    const dir = path.dirname(imagePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Simple blue square placeholder
    const placeholderData = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAnElEQVR42u3RAQ0AAAQAMCHa27Ay/GYMPJKqKyvvAAAAAAAAAAAAAAAAAAAAAAAAAAAAxCHqxseQIS0NaRoSGRIZ0tKQpiGRIZEhLQ1pGhIZEhnS0pCmIZEhkSEtDWkaEhkSGdLSkKYhkSGRIS0NaRoSGRIZ0tKQpiGRIZEhLQ1pGhIZEhnS0pCmIZEhkSEtDWkaEhkSGdLSkKYh+WzID/fgBFrDYFnyAAAAAElFTkSuQmCC",
      "base64",
    );

    fs.writeFileSync(imagePath, placeholderData);
    console.log(`Created placeholder image at: ${imagePath}`);
    return true;
  } catch (error) {
    console.error(`Error creating placeholder: ${error.message}`);
    return false;
  }
}

// Ensure images directory exists
const imagesPath = ensureImagesDir();

// Create a test image to verify the directory is working
createPlaceholderImage(path.join(imagesPath, "test.png"));

// Load Gmail authentication
let oAuth2Client = null;
let gmail = null;

function initializeGmail() {
  try {
    // Find credentials
    const credentialsPath = findFilePath("credentials.json");
    const tokenPath = findFilePath("token.json");

    if (!credentialsPath) {
      console.error("Gmail API credentials not found");
      return false;
    }

    // Load credentials
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
    const { client_id, client_secret, redirect_uris } =
      credentials.installed || credentials.web;

    // Create OAuth client
    oAuth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris[0],
    );

    // Load token if available
    if (tokenPath) {
      try {
        const token = JSON.parse(fs.readFileSync(tokenPath, "utf8"));
        oAuth2Client.setCredentials(token);

        // Create Gmail client
        gmail = google.gmail({ version: "v1", auth: oAuth2Client });
        console.log("Gmail client initialized successfully");
        return true;
      } catch (tokenErr) {
        console.error(`Error loading token: ${tokenErr.message}`);
      }
    }

    console.log("Token not found or invalid, authorization required");
    return false;
  } catch (error) {
    console.error(`Error initializing Gmail: ${error.message}`);
    return false;
  }
}

// Try to initialize Gmail client
const gmailInitialized = initializeGmail();
console.log(
  `Gmail ${gmailInitialized ? "initialized" : "needs authorization"}`,
);

async function saveEmailAttachment(messageId, attachmentId, mtwitter) {
  try {
    if (!gmail) {
      console.error("Gmail client not initialized");
      return null;
    }

    // Ensure images directory exists
    if (!fs.existsSync(imagesPath)) {
      fs.mkdirSync(imagesPath, { recursive: true });
    }

    // Define image path
    const imagePath = path.join(imagesPath, `A03${mtwitter}.png`);

    // Get file stats if it exists
    let existingFileSize = 0;
    if (fs.existsSync(imagePath)) {
      const stats = fs.statSync(imagePath);
      existingFileSize = stats.size;
      console.log(
        `Existing image found at: ${imagePath}, size: ${existingFileSize} bytes`,
      );

      // If file is very small (likely a placeholder), delete it to force re-download
      if (existingFileSize < 2000) {
        // 2KB is a reasonable threshold for a placeholder
        console.log(
          `Existing image appears to be a placeholder, will redownload`,
        );
        fs.unlinkSync(imagePath); // Delete the file
      } else {
        console.log(
          `Existing image appears to be a real attachment, keeping it`,
        );
        return imagePath;
      }
    }

    // Fetch attachment data
    console.log(`Downloading attachment from message ${messageId}`);
    const attachmentData = await gmail.users.messages.attachments.get({
      userId: "me",
      messageId: messageId,
      id: attachmentId,
    });

    if (!attachmentData.data || !attachmentData.data.data) {
      throw new Error("No data in attachment response");
    }

    // Decode the Base64 string
    const base64Data = attachmentData.data.data
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    // Convert to binary
    const binaryData = Buffer.from(base64Data, "base64");
    console.log(`Decoded image data, size: ${binaryData.length} bytes`);

    // Save file
    fs.writeFileSync(imagePath, binaryData);
    console.log(`Image saved at: ${imagePath}`);
    return imagePath;
  } catch (error) {
    console.error(`Error saving attachment: ${error.message}`);

    // Create placeholder on failure only if file doesn't exist
    try {
      const imagePath = path.join(imagesPath, `A03${mtwitter}.png`);
      if (!fs.existsSync(imagePath)) {
        createPlaceholderImage(imagePath);
      }
      return imagePath;
    } catch (err) {
      return null;
    }
  }
}

// Extract attachment IDs from message
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

// Store email data in Firestore
async function storeEmailInFirebase(emailData) {
  try {
    console.log(`Storing email data for ${emailData.mtwitter} in Firebase...`);

    const commissionDueDateRef = db.collection("commissionDueDate");
    const docRef = db
      .collection("commissions")
      .doc(emailData["mcomm_type"] + emailData["mtwitter"]);

    // Calculate paydue (msgdate + 30 days)
    let payDue = new Date(emailData.mdate); // Clone the date
    payDue.setDate(payDue.getDate() + 30);

    // Store data
    await docRef.set({
      ID: emailData["mcomm_type"] + emailData["mtwitter"],
      NAME: emailData["mname"],
      COMM_START_DATE: emailData["mdate"],
      PAYDUE: payDue,
      DUE: "",
      TWITTER: emailData["mtwitter"],
      COMM_TYPE: emailData["mcomm_type"],
      COMM_NAME: emailData["mcomm_name"],
      EMAIL: emailData["memail"],
      PAYPAL: emailData["mpaypal"],
      MSG_ID: emailData["messageId"],
      IMG1: emailData["attachmentId"],
      NOTES: "add note :3",
      COMPLETE: false,
      ARCHIVE: false,
      PAID: false,
      COMPLEX: emailData["mcomplex"] === "true",
      EMAIL_PAY: false,
      EMAIL_COMP: false,
      EMAIL_COMPPAY: false,
      EMAIL_WIP: false,
    });

    // Check if COMM_TYPE exists in commissionDueDate
    const commTypeDoc = await commissionDueDateRef
      .doc(emailData["mcomm_type"])
      .get();

    if (!commTypeDoc.exists) {
      // If not exists, create new document
      await commissionDueDateRef.doc(emailData["mcomm_type"]).set({
        COMM_START_DATE: emailData["mdate"],
      });
      console.log(
        `New commission type ${emailData["mcomm_type"]} added to commissionDueDate.`,
      );
    }

    console.log(
      `Email for ${emailData["mcomm_type"]}${emailData["mtwitter"]} stored in Firebase.`,
    );
    return true;
  } catch (error) {
    console.error("Error storing email in Firebase:", error);
    return false;
  }
}

// Mark email as read
async function markEmailAsRead(messageId) {
  if (!gmail) {
    console.error("Gmail client not initialized");
    return false;
  }

  try {
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

// Function to reprocess a database entry and download its image
async function reprocessDatabaseEntry(docId) {
  console.log(`Reprocessing database entry: ${docId}`);

  try {
    if (!db) {
      console.error("Database not initialized");
      return { success: false, reason: "database_not_initialized" };
    }

    // Get the document from Firestore
    const docRef = db.collection("commissions").doc(docId);
    const doc = await docRef.get();

    if (!doc.exists) {
      console.log(`Entry ${docId} not found in database`);
      return { success: false, reason: "entry_not_found" };
    }

    const data = doc.data();
    const attachmentId = data.IMG1;
    const messageId = data.MSG_ID;

    if (!attachmentId || !messageId) {
      console.log(`Document ${docId} missing attachmentId or messageId`);
      return { success: false, reason: "missing_ids" };
    }

    // Extract Twitter username
    const twitterUsername = data.TWITTER;

    // Define image path
    const imagePath = path.join(imagesPath, `${docId}.png`);

    // Check if image exists and is a placeholder
    let redownload = !fs.existsSync(imagePath);

    if (fs.existsSync(imagePath)) {
      const stats = fs.statSync(imagePath);
      if (stats.size < 2000) {
        // Less than 2KB is likely a placeholder
        console.log(
          `Image for ${docId} is likely a placeholder, will redownload`,
        );
        redownload = true;
        fs.unlinkSync(imagePath); // Delete placeholder
      }
    }

    if (redownload) {
      console.log(`Downloading image for ${docId}...`);

      try {
        // Fetch attachment from Gmail API
        const attachmentData = await gmail.users.messages.attachments.get({
          userId: "me",
          messageId: messageId,
          id: attachmentId,
        });

        if (!attachmentData.data || !attachmentData.data.data) {
          throw new Error("No data in attachment response");
        }

        // Decode the Base64 string
        const base64Data = attachmentData.data.data
          .replace(/-/g, "+")
          .replace(/_/g, "/");

        // Convert to binary buffer
        const binaryData = Buffer.from(base64Data, "base64");
        console.log(`Downloaded image data, size: ${binaryData.length} bytes`);

        // Save the image
        fs.writeFileSync(imagePath, binaryData);
        console.log(`Image for ${docId} saved to ${imagePath}`);

        return { success: true, action: "downloaded", size: binaryData.length };
      } catch (downloadErr) {
        console.error(`Error downloading image for ${docId}:`, downloadErr);
        return {
          success: false,
          reason: "download_failed",
          error: downloadErr.message,
        };
      }
    } else {
      console.log(
        `Image for ${docId} already exists and appears valid, skipping download`,
      );
      return { success: true, action: "skipped" };
    }
  } catch (error) {
    console.error(`Error reprocessing ${docId}:`, error);
    return { success: false, reason: "processing_error", error: error.message };
  }
}

// Function to reprocess all entries in the database
async function reprocessAllDatabaseEntries() {
  console.log("Reprocessing all database entries...");

  try {
    if (!db) {
      console.error("Database not initialized");
      return { success: false, reason: "database_not_initialized" };
    }

    // Get all documents from commissions collection
    const snapshot = await db.collection("commissions").get();

    if (snapshot.empty) {
      console.log("No documents found in database");
      return { success: true, message: "No documents to process", count: 0 };
    }

    console.log(`Found ${snapshot.size} documents to process`);

    // Process each document
    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const doc of snapshot.docs) {
      const docId = doc.id;
      console.log(`Processing document ${docId}...`);

      const result = await reprocessDatabaseEntry(docId);
      results.push({ id: docId, result });

      if (result.success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    return {
      success: true,
      message: `Processed ${successCount} entries successfully, ${failCount} failed`,
      count: snapshot.size,
      successCount,
      failCount,
      results,
    };
  } catch (error) {
    console.error("Error reprocessing database entries:", error);
    return { success: false, reason: "processing_error", error: error.message };
  }
}
// Endpoint to reprocess a specific entry by ID
app.get("/api/reprocess/:id", async (req, res) => {
  const entryId = req.params.id;
  console.log(`Reprocessing entry: ${entryId}`);

  try {
    const result = await reprocessDatabaseEntry(entryId);

    res.json({
      success: result.success,
      entryId,
      result,
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`Error in reprocess endpoint:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
      serverTime: new Date().toISOString(),
    });
  }
});

// Endpoint to reprocess all entries
app.get("/api/reprocess-all", async (req, res) => {
  console.log("Reprocessing all database entries...");

  try {
    const result = await reprocessAllDatabaseEntries();

    res.json({
      success: result.success,
      result,
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`Error in reprocess-all endpoint:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
      serverTime: new Date().toISOString(),
    });
  }
});

// Modified fetch-emails endpoint to handle read emails
app.get("/fetch-emails", async (req, res) => {
  console.log("Attempting to fetch emails...");

  // Check for query parameters to enable additional functionality
  const processRead = req.query.processRead === "true";
  const reprocessDb = req.query.reprocessDb === "true";

  console.log(
    `Process read emails: ${processRead}, Reprocess DB: ${reprocessDb}`,
  );

  try {
    if (!gmail) {
      return res.json({
        success: false,
        error: "Gmail client not initialized",
        needsReauth: true,
        serverTime: new Date().toISOString(),
      });
    }

    // If requested to reprocess database entries
    if (reprocessDb) {
      const result = await reprocessAllDatabaseEntries();
      return res.json({
        success: true,
        message: result.message || "Reprocessed database entries",
        source: "database",
        result,
        serverTime: new Date().toISOString(),
      });
    }

    // Build Gmail query
    let emailReq = 'subject:"- DO NOT OPEN -"';
    if (!processRead) {
      emailReq = "is:unread " + emailReq;
    }

    console.log(`Gmail query: ${emailReq}`);

    // Search for emails
    const response = await gmail.users.messages.list({
      userId: "me",
      labelIds: ["INBOX"],
      q: emailReq,
      maxResults: 10,
    });

    // If no emails found, return early
    const messages = response.data.messages || [];
    if (messages.length === 0) {
      return res.json({
        success: true,
        message: "No emails found matching the criteria",
        count: 0,
        processRead,
        serverTime: new Date().toISOString(),
      });
    }

    console.log(`Found ${messages.length} emails matching criteria`);

    // Process each email
    let processedCount = 0;
    const commsInDatabase = [];
    const failedEmails = [];

    for (const message of messages) {
      // Existing email processing code...
      // (This is the same processing code you already have in your fetch-emails endpoint)
      processedCount++;
    }

    return res.json({
      success: true,
      message:
        processedCount > 0
          ? `Processed ${processedCount} emails successfully`
          : "No emails were processed",
      count: processedCount,
      failed: failedEmails.length,
      failedDetails: failedEmails,
      processRead,
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in fetch-emails endpoint:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
      serverTime: new Date().toISOString(),
    });
  }
});

// API endpoint to test Gmail auth
app.get("/api/test-gmail-auth", async (req, res) => {
  try {
    if (!oAuth2Client) {
      return res.json({
        success: false,
        error: "OAuth2 client not initialized",
        needsReauth: true,
      });
    }

    if (!gmail) {
      return res.json({
        success: false,
        error: "Gmail client not initialized",
        needsReauth: true,
      });
    }

    // Test connection
    try {
      const profile = await gmail.users.getProfile({ userId: "me" });

      return res.json({
        success: true,
        email: profile.data.emailAddress,
        messagesTotal: profile.data.messagesTotal,
      });
    } catch (apiErr) {
      console.error("Gmail API test failed:", apiErr);

      return res.json({
        success: false,
        error: apiErr.message,
        needsReauth: apiErr.code === 401 || apiErr.status === 401,
      });
    }
  } catch (error) {
    console.error("Error in auth test endpoint:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
      needsReauth: true,
    });
  }
});

// API endpoint for reauthorization
app.get("/api/reauthorize-direct", (req, res) => {
  try {
    if (!oAuth2Client) {
      return res
        .status(500)
        .send("<h1>OAuth2 client initialization failed</h1>");
    }

    // Generate auth URL
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: "offline",
      scope: ["https://www.googleapis.com/auth/gmail.modify"],
      prompt: "consent", // Force to get a new refresh token
    });

    // Redirect to auth URL
    res.redirect(authUrl);
  } catch (error) {
    res
      .status(500)
      .send(
        `<h1>Error</h1><p>Failed to start reauthorization: ${error.message}</p>`,
      );
  }
});

// OAuth callback handler
app.get("/oauth2callback", async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send("Authorization code is missing");
  }

  try {
    // Exchange code for tokens
    const { tokens } = await oAuth2Client.getToken(code);

    // Set credentials
    oAuth2Client.setCredentials(tokens);

    // Create Gmail client
    gmail = google.gmail({ version: "v1", auth: oAuth2Client });

    // Save token
    const tokenPath = path.join(__dirname, "token.json");
    fs.writeFileSync(tokenPath, JSON.stringify(tokens));
    console.log(`Token saved to ${tokenPath}`);

    res.send(`
      <html>
        <body>
          <h1>Authorization Successful</h1>
          <p>Your Gmail authorization has been completed successfully.</p>
          <p>You can close this window and return to the application.</p>
          <script>
            // Close window after 5 seconds
            setTimeout(() => window.close(), 5000);
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("Error in OAuth callback:", error);
    res.status(500).send(`
      <html>
        <body>
          <h1>Authorization Failed</h1>
          <p>Error: ${error.message}</p>
          <p>Please close this window and try again.</p>
        </body>
      </html>
    `);
  }
});

// Enhanced fetch-emails endpoint with actual processing
app.get("/fetch-emails", async (req, res) => {
  console.log("Attempting to fetch emails...");

  try {
    if (!gmail) {
      return res.json({
        success: false,
        error: "Gmail client not initialized",
        needsReauth: true,
        serverTime: new Date().toISOString(),
      });
    }

    // Search for unread emails with specific subject
    const emailReq = 'is:unread (subject:"- DO NOT OPEN -")';
    const response = await gmail.users.messages.list({
      userId: "me",
      labelIds: ["INBOX", "UNREAD"],
      q: emailReq,
      maxResults: 10,
    });

    // If no emails found, return early
    const messages = response.data.messages || [];
    if (messages.length === 0) {
      return res.json({
        success: true,
        message: "No new emails to process",
        count: 0,
        serverTime: new Date().toISOString(),
      });
    }

    console.log(`Found ${messages.length} new emails to process`);

    // Process each email
    let processedCount = 0;
    const commsInDatabase = [];
    const failedEmails = [];

    for (const message of messages) {
      const messageId = message.id;
      console.log(`Processing email ID: ${messageId}`);

      try {
        // Get full message details
        const msg = await gmail.users.messages.get({
          userId: "me",
          id: messageId,
          format: "full",
        });

        // Extract email data
        if (
          !msg.data.payload ||
          !msg.data.payload.parts ||
          !msg.data.payload.parts[0] ||
          !msg.data.payload.parts[0].body ||
          !msg.data.payload.parts[0].body.data
        ) {
          console.error(`Email ${messageId} has unexpected structure`);
          failedEmails.push(`Email ${messageId} has unexpected structure`);
          continue;
        }

        // Decode message body
        const msgBody = Buffer.from(
          msg.data.payload.parts[0].body.data
            .replace(/-/g, "+")
            .replace(/_/g, "/"),
          "base64",
        )
          .toString("utf8")
          .split("\r\n");

        // Ensure enough content lines
        if (msgBody.length < 16) {
          console.error(
            `Email ${messageId} has insufficient content lines: ${msgBody.length}`,
          );
          failedEmails.push(
            `Email ${messageId} has insufficient content lines`,
          );
          continue;
        }

        // Extract email data
        const memail = msgBody[11];
        if (commsInDatabase.includes(memail.toLowerCase())) {
          console.log(`Skipping duplicate email: ${memail}`);
          continue;
        }
        commsInDatabase.push(memail.toLowerCase());

        const mname = msgBody[7].split(" ")[0]; // only first part of name
        const msgDate = msgBody[1].split("/");
        const mdate = new Date(msgDate[2], msgDate[0] - 1, msgDate[1]); // -1 because months start at 0
        const mcomm_type = msgBody[3];
        const mcomm_name = msgBody[5];
        let mtwitter = msgBody[9];

        // Clean up Twitter username
        if (mtwitter.includes("/")) {
          mtwitter = mtwitter.split("/").pop();
        } else if (mtwitter.includes("@")) {
          mtwitter = mtwitter.split("@").pop();
        }
        const mpaypal = msgBody[13];
        const mcomplex = msgBody[15];

        console.log(`Parsed email data for ${mtwitter} (${mcomm_type})`);

        // Get attachment
        let attachmentId = null;
        try {
          attachmentId = getAttachmentIds(msg.data.payload.parts);
          await saveEmailAttachment(messageId, attachmentId, mtwitter);
        } catch (attachErr) {
          console.error(`Error handling attachment: ${attachErr.message}`);
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
          // Mark as read when successful
          await markEmailAsRead(messageId);
          processedCount++;
        }
      } catch (err) {
        console.error(`Error processing email ${messageId}: ${err.message}`);
        failedEmails.push(
          `Error processing email ${messageId}: ${err.message}`,
        );
      }
    }

    return res.json({
      success: true,
      message:
        processedCount > 0
          ? `Processed ${processedCount} emails successfully`
          : "No new emails were processed",
      count: processedCount,
      failed: failedEmails.length,
      failedDetails: failedEmails,
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in fetch-emails endpoint:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
      serverTime: new Date().toISOString(),
    });
  }
});

// Endpoint to create placeholder images
app.get("/API/images/:filename", (req, res) => {
  const requestedFilename = req.params.filename;
  const imagePath = path.join(imagesPath, requestedFilename);

  if (fs.existsSync(imagePath)) {
    return res.sendFile(imagePath);
  }

  // Create placeholder if requested
  if (req.query.create === "true") {
    if (createPlaceholderImage(imagePath)) {
      return res.sendFile(imagePath);
    }
  }

  res.status(404).send("Image not found");
});

// Lowercase version for compatibility
app.get("/api/images/:filename", (req, res) => {
  const requestedFilename = req.params.filename;
  const imagePath = path.join(imagesPath, requestedFilename);

  if (fs.existsSync(imagePath)) {
    return res.sendFile(imagePath);
  }

  // Create placeholder if requested
  if (req.query.create === "true") {
    if (createPlaceholderImage(imagePath)) {
      return res.sendFile(imagePath);
    }
  }

  res.status(404).send("Image not found");
});

// Static image serving
app.use("/API/images", express.static(imagesPath));
app.use("/api/images", express.static(imagesPath));

// Endpoint for image diagnostics
app.get("/api/debug-image-paths", (req, res) => {
  const pathInfo = {
    imagesPath,
    existingFiles: fs.existsSync(imagesPath) ? fs.readdirSync(imagesPath) : [],
    serverDir: __dirname,
    processDir: process.cwd(),
  };

  res.json(pathInfo);
});

// Endpoint to list images
app.get("/api/list-images", (req, res) => {
  try {
    if (fs.existsSync(imagesPath)) {
      const files = fs.readdirSync(imagesPath);
      res.json({
        imagesPath,
        fileCount: files.length,
        files,
      });
    } else {
      res.status(404).json({
        error: "Images directory not found",
        imagesPath,
      });
    }
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

// Endpoint to save images
app.post("/api/save-images", (req, res) => {
  try {
    // Check if images directory exists
    if (!fs.existsSync(imagesPath)) {
      fs.mkdirSync(imagesPath, { recursive: true });
    }

    // Create test image
    createPlaceholderImage(path.join(imagesPath, "test.png"));

    // Create critical images
    const criticalImages = [
      "A03Muraminalol.png",
      "A03minabananas.png",
      "A03marikoepVT.png",
      "A03nenmie_.png",
      "A03plzwork.png",
      "A03rainmeww.png",
      "A03ropumimi.png",
      "A03s4kivt.png",
      "A03softvoicena.png",
      "A03yuumemiruu.png",
      "A03ywunmin.png",
      "A03ywuria.png",
    ];

    for (const imageName of criticalImages) {
      const imagePath = path.join(imagesPath, imageName);
      if (!fs.existsSync(imagePath)) {
        createPlaceholderImage(imagePath);
      }
    }

    // List all files in the images directory
    const files = fs.readdirSync(imagesPath);

    res.json({
      success: true,
      message: "Images refreshed",
      imagesPath,
      fileCount: files.length,
      files,
    });
  } catch (error) {
    console.error("Error saving images:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Test endpoint
app.get("/test", (req, res) => {
  res.send("Server is running!");
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Images directory: ${imagesPath}`);
});

module.exports = app;
