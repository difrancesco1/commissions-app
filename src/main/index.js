const { app, shell, BrowserWindow, ipcMain } = require("electron");
const { join } = require("path");
const { electronApp, optimizer, is } = require("@electron-toolkit/utils");
const path = require("path");
const appRoot = path.join(__dirname, "../..");
const fs = require("fs");
const { google } = require("googleapis");
let imageUtils;
try {
  const imageUtilsPath = findFilePath("src/API/imageUtils.js", [
    path.join(process.resourcesPath || "", "src/API/imageUtils.js"),
    path.join(__dirname, "../../src/API/imageUtils.js"),
    path.join(__dirname, "../src/API/imageUtils.js"),
    path.join(__dirname, "src/API/imageUtils.js"),
  ]);

  if (imageUtilsPath) {
    imageUtils = require(imageUtilsPath);
  } else {
    console.error("Could not find imageUtils.js");
    imageUtils = {}; // Empty object as fallback
  }
} catch (err) {
  console.error("Error loading imageUtils:", err);
  imageUtils = {}; // Empty object as fallback
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  console.log("Another instance is already running - quitting this one");
  app.quit();
  process.exit(0);
}

// Track state
let mainWindow = null;
let server = null;
let db = null;
let gmail = null;
let gmailData = null;
let serverApp = null;
let imagesDir = null;

// Add this near the beginning of main.js after imports
app.whenReady().then(() => {
  if (process.env.NODE_ENV === "development" || !app.isPackaged) {
    // If this is a development environment, set imagesDir to the development path
    const devPaths = [
      path.join(app.getAppPath(), "src", "API", "images"),
      path.join(process.cwd(), "src", "API", "images"),
      path.join(__dirname, "..", "..", "src", "API", "images"),
      path.join(__dirname, "..", "src", "API", "images"),
    ];

    for (const testPath of devPaths) {
      try {
        const parentDir = path.dirname(testPath);
        if (fs.existsSync(parentDir)) {
          imagesDir = testPath;
          console.log(`DEVELOPMENT MODE: Using images directory: ${imagesDir}`);
          break;
        }
      } catch (err) {
        // Skip invalid paths
      }
    }
  }
});
// Utility functions for path resolution
function findFilePath(fileName, additionalPaths = []) {
  console.log(`Looking for file: ${fileName}`);

  // Try multiple locations
  const possiblePaths = [
    path.join(__dirname, fileName),
    path.join(__dirname, "../", fileName),
    path.join(__dirname, "../../", fileName),
    path.join(process.resourcesPath || "", fileName),
    path.join(process.cwd(), fileName),
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

// Function to initialize Gmail client
async function initializeGmail() {
  try {
    console.log("Initializing Gmail client");

    // Find paths to credentials and token files
    const resourcesPath = process.resourcesPath || app.getAppPath();
    const credentialsPath = findFilePath("src/API/credentials.json", [
      path.join(resourcesPath, "src/API/credentials.json"),
    ]);

    const tokenPath = findFilePath("src/API/token.json", [
      path.join(resourcesPath, "src/API/token.json"),
    ]);

    if (!credentialsPath) {
      console.error("Gmail API credentials not found");
      return null;
    }

    console.log(`Using credentials from: ${credentialsPath}`);
    if (tokenPath) {
      console.log(`Using token from: ${tokenPath}`);
    } else {
      console.log("No token file found - will need authorization");
    }

    // Load credentials
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
    const { client_id, client_secret, redirect_uris } =
      credentials.installed || credentials.web;

    // Create OAuth client
    const oauth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris[0],
    );

    // Load token if available
    if (tokenPath) {
      try {
        const token = JSON.parse(fs.readFileSync(tokenPath, "utf8"));
        oauth2Client.setCredentials(token);

        // Create Gmail client
        const gmailClient = google.gmail({ version: "v1", auth: oauth2Client });
        console.log("Gmail client initialized successfully");
        return { gmail: gmailClient, auth: oauth2Client };
      } catch (tokenErr) {
        console.error(`Error loading token: ${tokenErr.message}`);
      }
    }

    console.log("Token not found or invalid, authorization required");
    return { auth: oauth2Client, gmail: null };
  } catch (error) {
    console.error(`Error initializing Gmail: ${error.message}`);
    return null;
  }
}

// Firebase initialization function
async function initializeFirebase() {
  try {
    console.log("Initializing Firebase");

    // Find service account path
    const resourcesPath = process.resourcesPath || app.getAppPath();
    const serviceAccountPath = findFilePath(
      "src/API/commissions-app-c6e2c-firebase-adminsdk-fbsvc-473cacb7d7.json",
      [
        path.join(
          resourcesPath,
          "src/API/commissions-app-c6e2c-firebase-adminsdk-fbsvc-473cacb7d7.json",
        ),
      ],
    );

    if (!serviceAccountPath) {
      console.error("Firebase service account file not found");
      return null;
    }

    console.log(`Found service account at: ${serviceAccountPath}`);

    // Initialize Firebase
    const admin = require("firebase-admin");
    const serviceAccount = require(serviceAccountPath);

    // Check if Firebase is already initialized
    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://commissions-app-c6e2c.firebaseio.com",
      });
      console.log("Firebase app initialized successfully");
    } else {
      console.log("Firebase app was already initialized");
    }

    const db = admin.firestore();
    console.log("Firestore initialized successfully");
    return db;
  } catch (error) {
    console.error("Firebase initialization error:", error);
    return null;
  }
}

// Function to process email body and extract data
function parseEmailBody(msgBody) {
  try {
    console.log("Parsing email body");

    // Extract data from message body
    const dateStr = msgBody[1].trim();
    const dateParts = dateStr.split("/");
    const mdate = new Date(dateParts[2], dateParts[0] - 1, dateParts[1]); // month is 0-indexed

    const mcomm_type = msgBody[3].trim();
    const mcomm_name = msgBody[5].trim();
    const mname = msgBody[7].trim().split(" ")[0]; // only first part of name

    let mtwitter = msgBody[9].trim();
    // Clean up Twitter username
    if (mtwitter.includes("/")) {
      mtwitter = mtwitter.split("/").pop();
    } else if (mtwitter.includes("@")) {
      mtwitter = mtwitter.split("@").pop();
    }

    const memail = msgBody[11].trim();
    const mpaypal = msgBody[13].trim();
    const mcomplex = msgBody[15].trim().toLowerCase() === "true";

    return {
      mdate,
      mcomm_type,
      mcomm_name,
      mname,
      mtwitter,
      memail,
      mpaypal,
      mcomplex,
    };
  } catch (error) {
    console.error("Error parsing email body:", error);
    throw error;
  }
}

// Function to store commission data in Firebase
async function storeCommissionData(db, emailData) {
  try {
    if (!db) {
      console.error("Firestore not initialized");
      return false;
    }

    console.log(`Storing commission data for ${emailData.mtwitter}`);

    // Create document ID
    const docId = emailData.mcomm_type + emailData.mtwitter;

    // Get references
    const commissionsRef = db.collection("commissions");

    // Check if document already exists
    // const existingDoc = await commissionsRef.doc(docId).get();

    // if (existingDoc.exists) {
    //   console.log(`Document ${docId} already exists in database, skipping...`);
    //   return true;
    // }

    // Document doesn't exist, create it
    console.log(`Creating new document for ${docId}`);

    const commissionDueDateRef = db.collection("commissionDueDate");

    // Calculate pay due date (30 days from start date)
    const payDue = new Date(emailData.mdate);
    payDue.setDate(payDue.getDate() + 30);

    // Prepare data
    const commissionData = {
      ID: docId,
      NAME: emailData.mname,
      COMM_START_DATE: emailData.mdate,
      PAYDUE: payDue,
      DUE: "", // set after someone pays
      TWITTER: emailData.mtwitter,
      COMM_TYPE: emailData.mcomm_type,
      COMM_NAME: emailData.mcomm_name,
      EMAIL: emailData.memail,
      PAYPAL: emailData.mpaypal,
      MSG_ID: emailData.messageId,
      IMG1: emailData.attachmentId || "",
      NOTES: "add note :3",
      COMPLETE: false,
      ARCHIVE: false,
      PAID: false,
      COMPLEX: emailData.mcomplex,
      EMAIL_PAY: false,
      EMAIL_COMP: false,
      EMAIL_COMPPAY: false,
      EMAIL_WIP: false,
    };

    // Store the data
    await commissionsRef.doc(docId).set(commissionData);

    // Check if commission type already exists in commissionDueDate
    const commTypeDoc = await commissionDueDateRef
      .doc(emailData.mcomm_type)
      .get();

    if (!commTypeDoc.exists) {
      // If not exists, create it
      await commissionDueDateRef.doc(emailData.mcomm_type).set({
        COMM_START_DATE: emailData.mdate,
      });
      console.log(`Created new commission type entry: ${emailData.mcomm_type}`);
    }

    console.log(`Successfully stored commission data for ${docId}`);
    return true;
  } catch (error) {
    console.error(`Error storing commission data: ${error.message}`);
    return false;
  }
}

// Function to extract attachment IDs from message parts
function getAttachmentId(parts) {
  if (!parts) {
    return null;
  }

  let attachmentId = null;

  function processMessageParts(messageParts) {
    for (const part of messageParts) {
      if (part.body && part.body.attachmentId) {
        return part.body.attachmentId;
      }

      if (part.parts) {
        const result = processMessageParts(part.parts);
        if (result) {
          return result;
        }
      }
    }

    return null;
  }

  return processMessageParts(parts);
}

// Enhanced fetchEmails function with Firebase integration
async function fetchEmails(gmailClient, db, imagesDir) {
  try {
    console.log("Fetching and processing emails");

    if (!gmailClient) {
      return {
        success: false,
        error: "Gmail client not initialized",
        needsReauth: true,
      };
    }

    if (!db) {
      console.log(
        "Warning: Firebase not initialized, emails will be fetched but not stored",
      );
    }

    // Search for unread emails with specific subject
    const emailReq = 'is:unread subject:"- DO NOT OPEN -"';
    console.log(`Gmail query: ${emailReq}`);

    const response = await gmailClient.users.messages.list({
      userId: "me",
      labelIds: ["INBOX", "UNREAD"],
      q: emailReq,
      maxResults: 10,
    });

    // If no emails found, return early
    const messages = response.data.messages || [];
    if (messages.length === 0) {
      console.log("No unread emails found matching query");
      return {
        success: true,
        message: "No new emails to process",
        count: 0,
      };
    }

    // Process emails
    console.log(`Found ${messages.length} unread emails to process`);

    // Extract email details for each message
    const processedEmails = [];
    const failedEmails = [];

    for (const message of messages) {
      try {
        console.log(`Processing email ${message.id}`);

        // Get full message
        const msg = await gmailClient.users.messages.get({
          userId: "me",
          id: message.id,
          format: "full",
        });

        // Get message body
        const payload = msg.data.payload;
        if (
          !payload ||
          !payload.parts ||
          !payload.parts[0] ||
          !payload.parts[0].body
        ) {
          throw new Error("Email has unexpected structure");
        }

        // Decode message body
        const bodyData = payload.parts[0].body.data;
        if (!bodyData) {
          throw new Error("Email body data is missing");
        }

        const decodedBody = Buffer.from(
          bodyData.replace(/-/g, "+").replace(/_/g, "/"),
          "base64",
        ).toString("utf8");

        // Split into lines and parse
        const bodyLines = decodedBody.split("\r\n");
        if (bodyLines.length < 16) {
          throw new Error("Email has insufficient content lines");
        }

        // Parse the email body to extract data
        const parsedData = parseEmailBody(bodyLines);

        // Get attachment ID
        const attachmentId = getAttachmentId(payload.parts);

        // Download attachment if present
        let imagePath = null;
        if (attachmentId) {
          imagePath = await downloadAttachment(
            gmailClient,
            message.id,
            attachmentId,
            parsedData.mcomm_type,
            parsedData.mtwitter,
            imagesDir,
          );
        }

        // If we have Firebase, store the data
        if (db) {
          const storeResult = await storeCommissionData(db, {
            ...parsedData,
            messageId: message.id,
            attachmentId,
          });

          if (!storeResult) {
            console.warn(
              `Warning: Failed to store data for ${parsedData.mtwitter}`,
            );
          } else {
            // Try to immediately download the image for this commission
            if (attachmentId && message.id) {
              try {
                const docId = parsedData.mcomm_type + parsedData.mtwitter;
                console.log(
                  `Immediately downloading image for new commission: ${docId}`,
                );
                await downloadAttachment(
                  gmailClient,
                  message.id,
                  attachmentId,
                  parsedData.mcomm_type,
                  parsedData.mtwitter,
                  imagesDir,
                );
              } catch (imgErr) {
                console.error(
                  `Error downloading image for ${parsedData.mtwitter}: ${imgErr.message}`,
                );
              }
            }
          }
        }
        // Extract subject for response
        const headers = msg.data.payload.headers || [];
        const subject =
          headers.find((h) => h.name.toLowerCase() === "subject")?.value ||
          "No Subject";

        // Mark as read
        await gmailClient.users.messages.modify({
          userId: "me",
          id: message.id,
          resource: {
            removeLabelIds: ["UNREAD"],
          },
        });

        // Add to processed list
        processedEmails.push({
          id: message.id,
          subject,
          twitter: parsedData.mtwitter,
          commType: parsedData.mcomm_type,
          date: new Date(parseInt(msg.data.internalDate)).toISOString(),
          stored: !!db,
          attachment: !!imagePath,
        });

        console.log(`Successfully processed email for ${parsedData.mtwitter}`);
      } catch (emailError) {
        console.error(`Error processing email ${message.id}:`, emailError);
        failedEmails.push({
          id: message.id,
          error: emailError.message,
        });
      }
    }

    return {
      success: true,
      message:
        `Found and processed ${processedEmails.length} emails` +
        (failedEmails.length > 0 ? ` (${failedEmails.length} failed)` : ""),
      count: processedEmails.length,
      failedCount: failedEmails.length,
      emails: processedEmails,
      failed: failedEmails,
    };
  } catch (error) {
    console.error("Error fetching emails:", error);
    return {
      success: false,
      error: error.message,
      needsReauth: error.code === 401 || error.status === 401,
    };
  }
}

ipcMain.handle("fix-specific-image", async (event, imageName) => {
  console.log(`Fixing specific image: ${imageName}`);

  try {
    // Find a writable directory
    let imagesDir = null;
    const possibleDirs = [
      path.join(app.getPath("userData"), "images"),
      path.join(process.resourcesPath || "", "src/API/images"),
      path.join(app.getAppPath(), "src/API/images"),
      path.join(process.cwd(), "images"),
    ];

    for (const dir of possibleDirs) {
      try {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        // Test if directory is writable
        const testFile = path.join(dir, ".test");
        fs.writeFileSync(testFile, "test");
        fs.unlinkSync(testFile);

        imagesDir = dir;
        break;
      } catch (err) {
        console.log(`Directory ${dir} is not writable: ${err.message}`);
      }
    }

    if (!imagesDir) {
      return { success: false, error: "No writable directory found" };
    }

    // Create placeholder image
    const imagePath = path.join(imagesDir, imageName);
    console.log(`Creating placeholder for ${imagePath}`);

    // Simple blue square placeholder
    const placeholderData = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAnElEQVR42u3RAQ0AAAQAMCHa27Ay/GYMPJKqKyvvAAAAAAAAAAAAAAAAAAAAAAAAAAAAxCHqxseQIS0NaRoSGRIZ0tKQpiGRIZEhLQ1pGhIZEhnS0pCmIZEhkSEtDWkaEhkSGdLSkKYhkSGRIS0NaRoSGRIZ0tKQpiGRIZEhLQ1pGhIZEhnS0pCmIZEhkSEtDWkaEhkSGdLSkKYh+WzID/fgBFrDYFnyAAAAAElFTkSuQmCC",
      "base64",
    );

    fs.writeFileSync(imagePath, placeholderData);

    return {
      success: true,
      message: `Created placeholder image for ${imageName}`,
      path: imagePath,
    };
  } catch (error) {
    console.error("Error fixing specific image:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("reprocess-images", async (event) => {
  console.log("Development detection:", {
    NODE_ENV: process.env.NODE_ENV,
    isPackaged: app.isPackaged,
    isDev: process.env.NODE_ENV === "development" || !app.isPackaged,
    cwd: process.cwd(),
  });
  // Start the reprocessing
  console.log("Starting image reprocessing in background...");

  // Get reference to sender for communication
  const sender = event.sender;

  // Wrap the downloadAttachment function to send progress to frontend
  const originalDownloadAttachment = downloadAttachment;
  downloadAttachment = async function (...args) {
    const docId = args[3] + args[4]; // mcomm_type + mtwitter
    const targetDir = args[5];

    // Send starting info to frontend
    sender.send("download-progress", {
      status: "starting",
      docId: docId,
      targetDir: targetDir,
    });

    try {
      const result = await originalDownloadAttachment(...args);

      // Send success info to frontend
      sender.send("download-progress", {
        status: "complete",
        docId: docId,
        path: result,
      });

      return result;
    } catch (error) {
      // Send error info to frontend
      sender.send("download-progress", {
        status: "failed",
        docId: docId,
        error: error.message,
      });

      throw error;
    }
  };

  // Start the process
  reprocessImages()
    .then((result) => {
      console.log(
        "✅ Background reprocessing completed:",
        `${result.results?.successful || 0} images processed successfully to ${imagesDir}`,
      );
      // Restore original function
      downloadAttachment = originalDownloadAttachment;
    })
    .catch((err) => {
      console.error("❌ Background reprocessing error:", err);
      // Restore original function
      downloadAttachment = originalDownloadAttachment;
    });

  // Return immediately with a success message
  return {
    success: true,
    message: "Image reprocessing started in background",
    imagesDir: imagesDir,
  };
});

async function downloadAttachment(
  gmailClient,
  messageId,
  attachmentId,
  mcomm_type,
  mtwitter,
  targetDir,
) {
  const docId = mcomm_type + mtwitter;
  console.log(`DOWNLOADING IMAGE: ${docId}`);
  console.log(`TARGET DIRECTORY: ${targetDir}`);

  const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

  let imagesDir;
  if (targetDir) {
    // If explicitly provided, use that
    imagesDir = targetDir;
  } else if (isDev) {
    // In development, try multiple potential image directories
    const devPaths = [
      path.join(app.getAppPath(), "src", "API", "images"),
      path.join(process.cwd(), "src", "API", "images"),
      path.join(__dirname, "..", "..", "src", "API", "images"),
      path.join(__dirname, "..", "src", "API", "images"),
    ];

    let devDir = null;
    for (const testPath of devPaths) {
      try {
        // Check if parent directory exists
        const parentDir = path.dirname(testPath);
        if (fs.existsSync(parentDir)) {
          devDir = testPath;
          console.log(`Found valid development path: ${testPath}`);
          break;
        }
      } catch (err) {
        // Skip paths that cause errors
      }
    }

    if (devDir) {
      imagesDir = devDir;
      console.log(`Using DEV image directory: ${imagesDir}`);
    } else {
      // Fall back to userData if no dev path works
      imagesDir = path.join(app.getPath("userData"), "images");
      console.log(`No valid DEV paths found, using: ${imagesDir}`);
    }
  } else {
    // In production, use user data directory
    imagesDir = path.join(app.getPath("userData"), "images");
    console.log(`Using PROD image directory: ${imagesDir}`);
  }

  console.log(`📁 TARGET DIRECTORY: ${imagesDir}`);
  // Maximum number of retries for robustness
  const MAX_RETRIES = 5;

  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  const imagePath = path.join(imagesDir, `${docId}.png`);

  // For important debugging
  console.log({
    messageId,
    attachmentId: attachmentId.substring(0, 20) + "...", // Don't log the whole thing
    targetPath: imagePath,
    docId,
  });

  // Retry loop for resilience
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      // Tracking for performance issues
      const startTime = Date.now();
      console.log(
        `Download attempt ${attempt + 1}/${MAX_RETRIES} for ${docId}`,
      );

      // Fetch attachment data with timeout
      const attachmentPromise = gmailClient.users.messages.attachments.get({
        userId: "me",
        messageId: messageId,
        id: attachmentId,
      });

      // Set a reasonable timeout
      const timeoutPromise = new Promise(
        (_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(`Download timed out after ${30 * (attempt + 1)}s`),
              ),
            30000 * (attempt + 1),
          ), // Increase timeout with each retry
      );

      // Race the download against the timeout
      const attachmentData = await Promise.race([
        attachmentPromise,
        timeoutPromise,
      ]);

      // Make sure we got valid data
      if (
        !attachmentData ||
        !attachmentData.data ||
        !attachmentData.data.data
      ) {
        throw new Error(
          `No valid data in attachment response (attempt ${attempt + 1})`,
        );
      }

      const base64Data = attachmentData.data.data
        .replace(/-/g, "+")
        .replace(/_/g, "/");

      const imageBuffer = Buffer.from(base64Data, "base64");
      console.log(
        `Downloaded image data for ${docId}, size: ${imageBuffer.length} bytes, took ${Date.now() - startTime}ms`,
      );

      if (imageBuffer.length < 100) {
        throw new Error(
          `Downloaded image is suspiciously small: ${imageBuffer.length} bytes`,
        );
      }

      const dir = path.dirname(imagePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(imagePath, imageBuffer);
      console.log(`Successfully saved image for ${docId} to ${imagePath}`);

      const stats = fs.statSync(imagePath);
      if (stats.size !== imageBuffer.length) {
        throw new Error(
          `File size mismatch after save: expected ${imageBuffer.length}, got ${stats.size}`,
        );
      }

      return imagePath;
    } catch (error) {
      console.error(
        `Error downloading ${docId} (attempt ${attempt + 1}): ${error.message}`,
      );

      // Wait before retry with exponential backoff
      if (attempt < MAX_RETRIES - 1) {
        const delay = Math.min(30000, 1000 * Math.pow(2, attempt));
        console.log(`Waiting ${delay}ms before retry ${attempt + 2}...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        console.error(
          `All ${MAX_RETRIES} download attempts failed for ${docId}`,
        );
        throw error; // Re-throw on final attempt
      }
    }
  }

  throw new Error(`Failed to download after ${MAX_RETRIES} attempts`);
}
async function reprocessImages() {
  console.log("Starting image reprocessing with focus on real images...");

  try {
    // Make sure we have a writable directory
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    // Make sure services are initialized
    if (!db) {
      db = await initializeFirebase();
      if (!db) {
        return { success: false, error: "Failed to initialize database" };
      }
    }

    if (!gmail) {
      const gmailData = await initializeGmail();
      if (gmailData?.gmail) {
        gmail = gmailData.gmail;
      } else {
        return { success: false, error: "Failed to initialize Gmail API" };
      }
    }

    // Count results for reporting
    const results = {
      attempted: 0,
      successful: 0,
      failed: 0,
      details: [],
    };

    // Get all commission documents
    console.log("Fetching commission documents from Firestore...");
    const snapshot = await db.collection("commissions").get();

    if (snapshot.empty) {
      console.log("No commission documents found in database");
      return {
        success: true,
        message: "No commission documents found to process",
        results,
      };
    }

    console.log(`Found ${snapshot.size} commission documents to process`);

    // Process each document
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const docId = doc.id;

      // Skip documents without required fields
      if (!data.MSG_ID || !data.IMG1 || !data.TWITTER || !data.COMM_TYPE) {
        console.log(`Skipping document ${docId} - missing required fields`);
        results.details.push({
          id: docId,
          success: false,
          reason: "Missing required fields",
        });
        continue;
      }

      results.attempted++;

      try {
        console.log(`Processing document ${docId}...`);
        const imagePath = await downloadAttachment(
          gmail,
          data.MSG_ID,
          data.IMG1,
          data.COMM_TYPE,
          data.TWITTER,
          imagesDir,
        );

        if (imagePath) {
          results.successful++;
          results.details.push({
            id: docId,
            success: true,
            path: imagePath,
          });
        } else {
          results.failed++;
          results.details.push({
            id: docId,
            success: false,
            reason: "Download returned null path",
          });
        }
      } catch (err) {
        console.error(`Error processing ${docId}: ${err.message}`);
        results.failed++;
        results.details.push({
          id: docId,
          success: false,
          error: err.message,
        });
      }
    }

    return {
      success: true,
      message: `Processed ${results.attempted} images: ${results.successful} successful, ${results.failed} failed`,
      results,
    };
  } catch (error) {
    console.error("Error in reprocessImages:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}
// ----------------------------------------
// Embedded server with Gmail support
// ----------------------------------------
function startEmbeddedServer() {
  console.log("Starting embedded Express server...");

  try {
    // Import necessary modules
    const express = require("express");
    const cors = require("cors");
    const serverApp = express();
    const PORT = 5000;

    // Set up middleware
    serverApp.use(cors());

    // Determine appropriate images directory
    // Check if we're in development mode
    const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;
    console.log(`Development mode: ${isDev}`);

    let userImagesDir;
    if (isDev) {
      // Try development paths
      const devPaths = [
        path.join(app.getAppPath(), "src", "API", "images"),
        path.join(process.cwd(), "src", "API", "images"),
        path.join(__dirname, "..", "..", "src", "API", "images"),
        path.join(__dirname, "..", "src", "API", "images"),
      ];

      for (const testPath of devPaths) {
        try {
          const parentDir = path.dirname(testPath);
          if (fs.existsSync(parentDir)) {
            userImagesDir = testPath;
            console.log(
              `DEVELOPMENT MODE: Using images directory: ${userImagesDir}`,
            );
            break;
          }
        } catch (err) {
          // Skip invalid paths
        }
      }

      // Fall back to user data dir if no dev path found
      if (!userImagesDir) {
        userImagesDir = path.join(app.getPath("userData"), "images");
        console.log(`No valid dev paths found, using: ${userImagesDir}`);
      }
    } else {
      // Production mode - use user data directory
      userImagesDir = path.join(app.getPath("userData"), "images");
      console.log(`PRODUCTION MODE: Using images directory: ${userImagesDir}`);
    }

    if (!fs.existsSync(userImagesDir)) {
      fs.mkdirSync(userImagesDir, { recursive: true });
    }

    imagesDir = userImagesDir;

    console.log(`Using images directory: ${imagesDir}`);

    // Function to create placeholder image
    function createPlaceholderImage(imagePath) {
      try {
        console.log(`Creating placeholder image at: ${imagePath}`);

        const dir = path.dirname(imagePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        const placeholderData = Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAnElEQVR42u3RAQ0AAAQAMCHa27Ay/GYMPJKqKyvvAAAAAAAAAAAAAAAAAAAAAAAAAAAAxCHqxseQIS0NaRoSGRIZ0tLQpiGRIZEhLQ1pGhIZEhnS0pCmIZEhkSEtDWkaEhkSGdLSkKYhkSGRIS0NaRoSGRIZ0tLQpiGRIZEhLQ1pGhIZEhnS0pCmIZEhkSEtDWkaEhkSGdLSkKYh+WzID/fgBFrDYFnyAAAAAElFTkSuQmCC",
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

    const criticalImages = [];

    for (const imageName of criticalImages) {
      const imagePath = path.join(imagesDir, imageName);
      if (!fs.existsSync(imagePath)) {
        createPlaceholderImage(imagePath);
      }
    }

    // Initialize Gmail and Firebase only once
    let gmailData = null;
    (async () => {
      gmailData = await initializeGmail();
      if (gmailData?.gmail) {
        gmail = gmailData.gmail; // Update the global variable
        console.log("Gmail API initialized");
      } else {
        console.log("Gmail API initialization failed or needs auth");
      }

      db = await initializeFirebase(); // Update the global variable
      if (db) {
        console.log("Firebase initialized successfully");
      } else {
        console.log("Firebase initialization failed");
      }
    })();

    // ---------------------------------------
    // API ENDPOINTS
    // ---------------------------------------

    serverApp.get(
      ["/API/images/:filename", "/api/images/:filename"],
      async (req, res) => {
        const requestedFilename = req.params.filename;
        const imagePath = path.join(imagesDir, requestedFilename);

        console.log(`Image request for: ${requestedFilename}`);

        // If the file already exists locally, serve it immediately
        if (fs.existsSync(imagePath)) {
          console.log(`Serving existing image from: ${imagePath}`);
          return res.sendFile(imagePath);
        }

        // If it doesn't exist, try to download it from Gmail
        try {
          // Extract document ID from filename (remove extension)
          const docId = requestedFilename.replace(/\.[^/.]+$/, ""); // Remove file extension

          console.log(`Attempting to fetch image for document: ${docId}`);

          // Verify we have the necessary dependencies
          if (!db) {
            console.error("Database not initialized, can't fetch image data");
            throw new Error("Database not initialized");
          }

          if (!gmail) {
            console.error("Gmail not initialized, can't fetch image");
            throw new Error("Gmail client not initialized");
          }

          // Get document from Firestore
          const doc = await db.collection("commissions").doc(docId).get();

          if (!doc.exists) {
            console.error(`Document ${docId} not found in database`);
            throw new Error(`Document not found: ${docId}`);
          }

          // Get data from document
          const data = doc.data();
          const messageId = data.MSG_ID;
          const attachmentId = data.IMG1;
          const twitter = data.TWITTER;
          const commType = data.COMM_TYPE;

          if (!messageId || !attachmentId || !twitter || !commType) {
            console.error(`Missing required data fields for ${docId}`);
            throw new Error("Missing required data fields");
          }

          console.log(
            `Found document data, attempting to download attachment for ${docId}`,
          );

          // Download the image from Gmail
          const downloadedPath = await downloadAttachment(
            gmail,
            messageId,
            attachmentId,
            commType,
            twitter,
            imagesDir,
          );

          if (!downloadedPath || !fs.existsSync(downloadedPath)) {
            throw new Error("Download failed or file not created");
          }

          console.log(`Successfully downloaded image to ${downloadedPath}`);

          // Serve the downloaded file
          return res.sendFile(downloadedPath);
        } catch (error) {
          console.error(
            `Error retrieving image ${requestedFilename}: ${error.message}`,
          );

          // Create and serve a placeholder as fallback
          createPlaceholderImage(imagePath);
          console.log(`Created placeholder for ${requestedFilename}`);
          return res.sendFile(imagePath);
        }
      },
    );

    // Database test endpoint
    serverApp.get("/api/db-test", async (req, res) => {
      try {
        if (!db) {
          return res.json({
            success: false,
            error: "Database not initialized",
          });
        }

        // Try a simple query
        const snapshot = await db.collection("commissions").limit(1).get();

        return res.json({
          success: true,
          empty: snapshot.empty,
          count: snapshot.size,
        });
      } catch (error) {
        return res.json({ success: false, error: error.message });
      }
    });

    // Endpoint for Gmail auth test
    serverApp.get("/api/test-gmail-auth", async (req, res) => {
      console.log("Gmail auth test endpoint called");

      try {
        if (!gmailData) {
          gmailData = await initializeGmail();
        }

        if (!gmailData?.gmail) {
          return res.json({
            success: false,
            error: "Gmail client not initialized",
            needsReauth: true,
          });
        }

        try {
          // Test connection with a real API call
          const profile = await gmailData.gmail.users.getProfile({
            userId: "me",
          });

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

    // Debug image paths
    serverApp.get("/api/debug-image-paths", (req, res) => {
      try {
        const existingFiles = fs.existsSync(imagesDir)
          ? fs.readdirSync(imagesDir)
          : [];

        res.json({
          imagesPath: imagesDir,
          existingFiles,
          serverDir: __dirname,
          processDir: process.cwd(),
        });
      } catch (err) {
        res.status(500).json({
          error: err.message,
        });
      }
    });

    // Save images endpoint
    serverApp.post("/api/save-images", (req, res) => {
      try {
        // Check if images directory exists
        if (!fs.existsSync(imagesDir)) {
          fs.mkdirSync(imagesDir, { recursive: true });
        }

        // Create test image
        createPlaceholderImage(path.join(imagesDir, "test.png"));

        // Create critical images
        for (const imageName of criticalImages) {
          const imagePath = path.join(imagesDir, imageName);
          if (!fs.existsSync(imagePath)) {
            createPlaceholderImage(imagePath);
          }
        }

        // List all files in the images directory
        const files = fs.readdirSync(imagesDir);

        res.json({
          success: true,
          message: "Images refreshed",
          imagesPath: imagesDir,
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

    // Enhanced fetch-emails endpoint with Firebase integration
    serverApp.get("/fetch-emails", async (req, res) => {
      console.log("Fetch emails endpoint called with Firebase integration");

      try {
        if (!gmailData) {
          gmailData = await initializeGmail();
        }

        if (!db) {
          db = await initializeFirebase();
        }

        if (!gmailData?.gmail) {
          return res.json({
            success: false,
            error: "Gmail client not initialized",
            needsReauth: true,
            serverTime: new Date().toISOString(),
          });
        }

        const result = await fetchEmails(gmailData.gmail, db, imagesDir);
        result.serverTime = new Date().toISOString();

        res.json(result);
      } catch (error) {
        console.error("Error in fetch-emails endpoint:", error);
        return res.status(500).json({
          success: false,
          error: error.message,
          serverTime: new Date().toISOString(),
        });
      }
    });

    // Endpoint to reprocess all
    serverApp.get("/api/reprocess-all", (req, res) => {
      console.log("Reprocess all endpoint called");

      try {
        // For each critical image, ensure it exists
        let count = 0;
        for (const imageName of criticalImages) {
          const imagePath = path.join(imagesDir, imageName);
          try {
            if (
              !fs.existsSync(imagePath) ||
              fs.statSync(imagePath).size < 2000
            ) {
              if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath); // Delete if it's a placeholder
              }
              createPlaceholderImage(imagePath);
              count++;
            }
          } catch (err) {
            console.error(
              `Error processing image ${imageName}: ${err.message}`,
            );
          }
        }

        res.json({
          success: true,
          result: {
            message: `Reprocessed ${count} images successfully`,
            successCount: count,
            failCount: 0,
          },
          serverTime: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Error in reprocess endpoint:", error);
        res.status(500).json({
          success: false,
          error: error.message,
          serverTime: new Date().toISOString(),
        });
      }
    });

    // Endpoint for listing images
    serverApp.get("/api/list-images", (req, res) => {
      try {
        if (fs.existsSync(imagesDir)) {
          const files = fs.readdirSync(imagesDir);
          res.json({
            imagesPath: imagesDir,
            fileCount: files.length,
            files,
          });
        } else {
          res.status(404).json({
            error: "Images directory not found",
            imagesPath: imagesDir,
          });
        }
      } catch (err) {
        res.status(500).json({
          error: err.message,
        });
      }
    });

    // Endpoint to create placeholder images
    serverApp.get("/API/images/:filename", (req, res) => {
      const requestedFilename = req.params.filename;
      const imagePath = path.join(imagesDir, requestedFilename);

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

    // Endpoint to handle lowercase api path
    serverApp.get("/api/images/:filename", (req, res) => {
      const requestedFilename = req.params.filename;
      const imagePath = path.join(imagesDir, requestedFilename);

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

    // Test endpoint
    serverApp.get("/test", (req, res) => {
      res.send("Server is running!");
    });

    // OAuth callback handler
    serverApp.get("/oauth2callback", async (req, res) => {
      const { code } = req.query;

      if (!code) {
        return res.status(400).send("Authorization code is missing");
      }

      try {
        if (!gmailData?.auth) {
          gmailData = await initializeGmail();
        }

        if (!gmailData?.auth) {
          return res.status(500).send("OAuth2 client not initialized");
        }

        // Exchange code for tokens
        const { tokens } = await gmailData.auth.getToken(code);

        // Set credentials
        gmailData.auth.setCredentials(tokens);

        // Create Gmail client
        gmailData.gmail = google.gmail({ version: "v1", auth: gmailData.auth });
        // Update the global gmail variable
        gmail = gmailData.gmail;

        // Save token
        const resourcesPath = process.resourcesPath || app.getAppPath();
        const tokenPath = path.join(resourcesPath, "src/API/token.json");

        try {
          // Make sure parent directory exists
          const tokenDir = path.dirname(tokenPath);
          if (!fs.existsSync(tokenDir)) {
            fs.mkdirSync(tokenDir, { recursive: true });
          }

          fs.writeFileSync(tokenPath, JSON.stringify(tokens));
          console.log(`Token saved to ${tokenPath}`);
        } catch (writeErr) {
          console.error(`Error writing token: ${writeErr.message}`);
        }

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

    // Api endpoint for auth redirect
    serverApp.get("/api/reauthorize-direct", (req, res) => {
      try {
        if (!gmailData?.auth) {
          return res
            .status(500)
            .send("<h1>OAuth2 client initialization failed</h1>");
        }

        // Generate auth URL
        const authUrl = gmailData.auth.generateAuthUrl({
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

    // Enhanced fix-specific-image handler that prioritizes real image retrieval
    serverApp.get("/api/fix-specific-image", async (req, res) => {
      const imageName = req.query.name || "A03laeriedust.png";
      console.log(`⚡ Attempting to retrieve real image for: ${imageName}`);

      try {
        // Extract docId from image name (remove .png extension)
        const docId = imageName.replace(/\.png$/i, "");

        // Get actual database document reference
        const doc = await db.collection("commissions").doc(docId).get();

        if (!doc.exists) {
          return res.status(404).json({
            success: false,
            error: `Document ${docId} not found in database`,
          });
        }

        // Get Gmail attachment details
        const data = doc.data();
        const messageId = data.MSG_ID;
        const attachmentId = data.IMG1;

        if (!messageId || !attachmentId) {
          return res.status(400).json({
            success: false,
            error: `Document ${docId} is missing required fields (MSG_ID or IMG1)`,
          });
        }

        // Make sure Gmail is initialized
        if (!gmail) {
          return res.status(500).json({
            success: false,
            error: "Gmail API not initialized. Please try again later.",
          });
        }

        // Get Twitter and commission type for the image filename
        const twitter = data.TWITTER;
        const commType = data.COMM_TYPE;

        if (!twitter || !commType) {
          return res.status(400).json({
            success: false,
            error: `Document ${docId} is missing TWITTER or COMM_TYPE fields`,
          });
        }

        // Download with robust error handling
        try {
          console.log(
            `Attempting to download image for ${docId} using MessageID: ${messageId}`,
          );
          const imagePath = await downloadAttachment(
            gmail,
            messageId,
            attachmentId,
            commType,
            twitter,
            imagesDir, // Use the global variable
          );

          if (!imagePath) {
            throw new Error("Download returned null path");
          }

          // Verify the file was created
          const exists = fs.existsSync(imagePath);
          const stats = exists ? fs.statSync(imagePath) : null;
          const fileSize = stats ? stats.size : 0;

          return res.json({
            success: true,
            message: `Successfully downloaded image for ${imageName}`,
            path: imagePath,
            exists: exists,
            size: fileSize,
          });
        } catch (downloadErr) {
          console.error(
            `Failed to download ${imageName}: ${downloadErr.message}`,
          );

          return res.status(500).json({
            success: false,
            error: `Download failed: ${downloadErr.message}`,
            document: docId,
            messageId: messageId,
            attachmentIdPrefix: attachmentId.substring(0, 20) + "...",
          });
        }
      } catch (error) {
        console.error(`Error processing ${imageName}: ${error.message}`);

        return res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });
    // Create endpoint for A03laeriedust.png
    serverApp.get("/api/create-specific-image", async (req, res) => {
      try {
        const imageName = req.query.name || "A03laeriedust.png";
        console.log(`Creating specific image: ${imageName}`);

        // Create the image
        const imagePath = path.join(imagesDir, imageName);
        console.log(`Writing placeholder to: ${imagePath}`);

        createPlaceholderImage(imagePath);

        return res.json({
          success: true,
          path: imagePath,
          dir: imagesDir,
          message: `Created ${imageName} in ${imagesDir}`,
        });
      } catch (error) {
        return res.json({
          success: false,
          error: error.message,
        });
      }
    });

    // Modify your server startup to better handle port conflicts
    server = serverApp
      .listen(PORT, () => {
        console.log(`Express server running on port ${PORT}`);
      })
      .on("error", (error) => {
        if (error.code === "EADDRINUSE") {
          console.log(`Port ${PORT} is already in use, trying ${PORT + 1}`);
          // Your current implementation may not properly handle this
          server = serverApp.listen(PORT + 1, () => {
            console.log(`Express server running on port ${PORT + 1}`);
          });
        } else {
          console.error(`Server error: ${error.message}`);
        }
      });

    // Handle server errors
    server.on("error", (error) => {
      console.error(`Server error: ${error.message}`);
      if (error.code === "EADDRINUSE") {
        console.log(`Port ${PORT} is already in use, trying ${PORT + 1}`);
        server = serverApp.listen(PORT + 1);
      }
    });

    return true;
  } catch (err) {
    console.error(`Failed to start embedded server: ${err.message}`);
    return false;
  }
}

// Create the main window
function createWindow() {
  console.log("Creating main window...");

  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 322,
    height: 533,
    show: false,
    frame: false,
    transparent: true,
    titleBarStyle: "hidden",
    resizable: false,
    autoHideMenuBar: true,
    fullscreenable: false,
    icon: path.join(appRoot, "src/assets/icon.ico"),
    webPreferences: {
      sandbox: false,
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  // Load the appropriate URL
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

// App initialization
app.whenReady().then(async () => {
  console.log("App ready, initializing...");
  console.log(`Running in ${is.dev ? "development" : "production"} mode`);

  // CRITICAL: Use embedded server
  const serverStarted = startEmbeddedServer();
  if (!serverStarted) {
    console.error(
      "WARNING: Express server failed to start. Some features may not work correctly.",
    );
  }

  electronApp.setAppUserModelId("com.commissions-app");

  // Create the window
  createWindow();

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Handle second instance attempt
app.on("second-instance", (event, commandLine, workingDirectory) => {
  console.log("Second instance detected, focusing the main window");

  // Someone tried to run a second instance, focus our window instead
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// Window close handling
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// DevTools toggle
ipcMain.on("open-devtools", () => {
  if (mainWindow) {
    mainWindow.webContents.openDevTools();
  }
});

// App close handling
ipcMain.on("app-close", () => {
  if (server) {
    try {
      server.close(() => {
        console.log("Express server closed");
      });
    } catch (err) {
      console.error("Error closing server:", err);
    }
  }
  app.quit();
});

// Clean exit
app.on("quit", () => {
  console.log("App quitting, cleaning up...");
  if (server) {
    try {
      server.close();
    } catch (err) {
      console.error("Error closing server on quit:", err);
    }
  }
  app.exit(0);
});
