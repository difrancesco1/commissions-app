const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const isPackaged = !process.env.NODE_ENV === "development";
const resourcesPath = isPackaged ? process.resourcesPath : process.cwd();

// Load required modules
let startFetchingEmails;
let checkAndSaveImages;
let downloadAttachmentFromGmail;
let findImagesDirectory;
let db;
let gmail;

// Load email fetching module
try {
  const scriptPath = path.join(__dirname, "script.js");
  const scriptModule = require(scriptPath);
  startFetchingEmails = scriptModule.startFetchingEmails;
} catch (err) {
  // Try alternative paths
  const alternativePaths = [
    path.join(process.cwd(), "script.js"),
    path.join(process.cwd(), "src/API/script.js"),
    path.join(__dirname, "../script.js"),
  ];

  for (const altPath of alternativePaths) {
    if (fs.existsSync(altPath)) {
      const scriptModule = require(altPath);
      startFetchingEmails = scriptModule.startFetchingEmails;
      break;
    }
  }

  // Create a mock function if not found
  if (!startFetchingEmails) {
    startFetchingEmails = async () => ({
      success: true,
      message: "Mock email fetch (module not available)",
    });
  }
}

// Load image saving module
try {
  const imageSavePath = path.join(__dirname, "imageSave.js");
  checkAndSaveImages = require(imageSavePath);

  // Get needed functions from module
  if (typeof checkAndSaveImages === "object") {
    downloadAttachmentFromGmail =
      checkAndSaveImages.downloadAttachmentFromGmail;
    findImagesDirectory = checkAndSaveImages.findImagesDirectory;
    db = checkAndSaveImages.db;
    gmail = checkAndSaveImages.gmail;
  }
} catch (err) {
  // Try alternative paths
  const alternativePaths = [
    path.join(process.cwd(), "imageSave.js"),
    path.join(process.cwd(), "src/API/imageSave.js"),
    path.join(__dirname, "../imageSave.js"),
  ];

  for (const altPath of alternativePaths) {
    if (fs.existsSync(altPath)) {
      checkAndSaveImages = require(altPath);
      break;
    }
  }

  // Create a mock function if not found
  if (!checkAndSaveImages) {
    checkAndSaveImages = async () => ({
      success: true,
      message: "Mock image save (module not available)",
    });
  }
}

// Create the Express app
const app = express();
const port = process.env.PORT || 5000;

// Enable CORS
app.use(cors());

// Find the images directory
let imagesPath = null;
const possibleImagePaths = [
  path.join(__dirname, "images"),
  path.join(__dirname, "../images"),
  path.join(process.resourcesPath || "", "src/API/images"),
  path.join(process.cwd(), "src/API/images"),
  path.join(process.cwd(), "images"),
];

// Find existing images directory
for (const testPath of possibleImagePaths) {
  try {
    if (fs.existsSync(testPath)) {
      imagesPath = testPath;
      break;
    }
  } catch (err) {
    // Skip if path not accessible
  }
}

// Create directory if not found
if (!imagesPath) {
  const fallbackPaths = [
    path.join(__dirname, "images"),
    path.join(process.cwd(), "images"),
  ];

  for (const tryPath of fallbackPaths) {
    try {
      fs.mkdirSync(tryPath, { recursive: true });
      imagesPath = tryPath;
      break;
    } catch (err) {
      // Skip if directory creation fails
    }
  }

  // Default path as fallback
  if (!imagesPath) {
    imagesPath = path.join(__dirname, "images");
  }
}

// Create a test image
if (imagesPath) {
  const testImagePath = path.join(imagesPath, "test.png");
  try {
    const testPngData = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    fs.writeFileSync(testImagePath, testPngData);
  } catch (err) {
    // Ignore test image creation failure
  }
}

// Image serving middleware
app.use(
  "/API/images",
  (req, res, next) => {
    const fullPath = path.join(imagesPath, req.path);
    let fileExists = false;

    try {
      fileExists = fs.existsSync(fullPath);
    } catch (err) {
      // Silently handle error
    }

    if (!fileExists) {
      return res.status(404).send("Image not found");
    }
    next();
  },
  express.static(imagesPath),
);

// Also serve images from lowercase path for compatibility
app.use("/api/images", express.static(imagesPath));

// API routes
app.post("/api/save-images", async (req, res) => {
  console.log("Received save-images request");
  try {
    const result = await checkAndSaveImages();
    console.log("Image save result:", result);
    res.status(200).send(result || "Images refreshed successfully");
  } catch (error) {
    console.error("Error during image refresh:", error);
    res.status(500).send({
      error: "Failed to refresh images",
      message: error.message,
    });
  }
});

// Email fetching endpoint
app.get("/fetch-emails", async (req, res) => {
  console.log("Received fetch-emails request");
  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Email fetch timeout after 30 seconds")),
        30000,
      ),
    );

    const result = await Promise.race([startFetchingEmails(), timeoutPromise]);
    console.log("Email fetch completed successfully");
    res.send(result || "Emails fetched successfully");
  } catch (error) {
    console.error("Error fetching emails:", error);
    res.status(500).json({
      error: "Failed to fetch emails",
      message: error.message,
    });
  }
});

// Server test endpoint
app.get("/test", (req, res) => {
  res.send("Server is running properly");
});

// List images endpoint
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

// Debug endpoints for image downloading
app.get("/api/debug-image/:docId", async (req, res) => {
  const docId = req.params.docId;
  if (!docId) {
    return res.status(400).json({ error: "Document ID required" });
  }

  try {
    // Get document from Firestore
    const docRef = db.collection("commissions").doc(docId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Document not found" });
    }

    const data = doc.data();
    const attachmentId = data.IMG1;
    const messageId = data.MSG_ID;

    res.json({
      success: true,
      docId: docId,
      exists: true,
      attachmentId: attachmentId
        ? {
            exists: !!attachmentId,
            length: attachmentId ? attachmentId.length : 0,
            preview: attachmentId
              ? attachmentId.substring(0, 50) + "..."
              : null,
          }
        : null,
      messageId: messageId
        ? {
            exists: !!messageId,
            value: messageId,
          }
        : null,
      allFields: Object.keys(data),
    });
  } catch (error) {
    console.error("Error in debug endpoint:", error);
    res.status(500).json({
      error: "Server error",
      message: error.message,
    });
  }
});

// Endpoint to test downloading a single image
app.get("/api/test-download/:docId", async (req, res) => {
  const docId = req.params.docId;

  try {
    // Get document from Firestore
    const docRef = db.collection("commissions").doc(docId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Document not found" });
    }

    const data = doc.data();
    const attachmentId = data.IMG1;
    const messageId = data.MSG_ID;

    if (!attachmentId || !messageId) {
      return res.status(400).json({
        error: "Missing data",
        hasAttachmentId: !!attachmentId,
        hasMessageId: !!messageId,
      });
    }

    // Try to download the attachment
    const targetDir = imagesPath || path.join(__dirname, "images");
    const imagePath = path.join(targetDir, `${docId}-test.png`);

    // Download attachment using our fixed method
    const imageBuffer = await downloadAttachmentFromGmail(
      attachmentId,
      messageId,
    );

    // Save the image
    await fs.promises.writeFile(imagePath, imageBuffer);

    res.json({
      success: true,
      message: `Image downloaded and saved to ${imagePath}`,
      size: imageBuffer.length,
      path: imagePath,
    });
  } catch (error) {
    console.error("Test download error:", error);
    res.status(500).json({
      error: "Download failed",
      message: error.message,
    });
  }
});

// List documents with attachment IDs for debugging
app.get("/api/debug/list-docs", async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({
        error: "Database not initialized",
      });
    }

    const snapshot = await db.collection("commissions").get();

    if (snapshot.empty) {
      return res.json({
        count: 0,
        documents: [],
      });
    }

    const documents = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      documents.push({
        id: doc.id,
        twitter: data.TWITTER || "",
        hasAttachment: !!data.IMG1,
        hasMessageId: !!data.MSG_ID,
        attachmentLength: data.IMG1 ? data.IMG1.length : 0,
      });
    });

    res.json({
      count: documents.length,
      documents,
    });
  } catch (error) {
    console.error("List docs error:", error);
    res.status(500).json({
      error: error.message,
    });
  }
});

// Diagnostic endpoint
app.get("/diagnostic", (req, res) => {
  const info = {
    serverTime: new Date().toISOString(),
    currentDirectory: __dirname,
    workingDirectory: process.cwd(),
    imagesPath: imagesPath,
    imagesExist: fs.existsSync(imagesPath),
  };

  if (info.imagesExist) {
    try {
      const files = fs.readdirSync(imagesPath);
      info.imageCount = files.length;
      info.imageExamples = files.slice(0, 5);
    } catch (err) {
      info.imageError = err.message;
    }
  }

  res.json(info);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({
    error: "Something broke on the server",
    message: err.message,
  });
});

// Handle uncaught errors
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

// Start the server
let serverInstance;
try {
  serverInstance = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`Test image at: http://localhost:${port}/API/images/test.png`);
  });

  serverInstance.on("error", (error) => {
    console.error(`Server error: ${error.message}`);
    if (error.code === "EADDRINUSE") {
      console.error(`Port ${port} is already in use. Trying next port.`);
      serverInstance = app.listen(port + 1, () => {
        const newPort = port + 1;
        console.log(`Server now running on port ${newPort}`);
      });
    }
  });
} catch (err) {
  console.error(`Failed to start server: ${err.message}`);
}

// Handle graceful shutdown
function shutDown() {
  console.log("Received kill signal, shutting down gracefully");
  if (serverInstance) {
    serverInstance.close(() => {
      console.log("Closed out remaining connections");
      process.exit(0);
    });

    // Force close after 10s
    setTimeout(() => {
      console.error(
        "Could not close connections in time, forcefully shutting down",
      );
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
}

process.on("SIGTERM", shutDown);
process.on("SIGINT", shutDown);
