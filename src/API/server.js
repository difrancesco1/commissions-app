const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");

// Attempt to load optional dependencies - with much better error handling
let startFetchingEmails;
try {
  const scriptModule = require("./script");
  startFetchingEmails = scriptModule.startFetchingEmails;
  console.log("Successfully loaded script.js and startFetchingEmails function");
} catch (err) {
  console.error(`Error loading script.js: ${err.message}`);
  console.error(err.stack);

  // Create a mock function that returns success
  startFetchingEmails = async () => {
    console.log("Mock startFetchingEmails called (module not available)");
    return { success: true, message: "Mock email fetch (module not available)" };
  };
}

// Similar approach for image saving
let checkAndSaveImages;
try {
  checkAndSaveImages = require("./imageSave");
  console.log("Successfully loaded imageSave.js");
} catch (err) {
  console.error(`Error loading imageSave.js: ${err.message}`);
  console.error(err.stack);

  // Create a mock function that returns success
  checkAndSaveImages = async () => {
    console.log("Mock checkAndSaveImages called (module not available)");
    return { success: true, message: "Mock image save (module not available)" };
  };
}

// Create the Express app
const app = express();

// Get port from environment or use default
const port = process.env.PORT || 5000;

// Add extensive logging
console.log("============ SERVER STARTING ============");
console.log(`Server starting at: ${new Date().toISOString()}`);
console.log(`Server process ID: ${process.pid}`);
console.log(`Current directory: ${__dirname}`);
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`Node version: ${process.version}`);
console.log(`Platform: ${process.platform}`);

// Enable CORS
app.use(cors());

// Find the images directory with better path detection and more logging
console.log("Searching for images directory...");

// Possible locations for the images directory
const possibleImagePaths = [
  path.join(__dirname, "images"),                  // Default path
  path.join(__dirname, "../images"),               // One level up
  path.join(__dirname, "../../images"),            // Two levels up
  path.join(__dirname, "../../src/API/images"),    // Source location
  path.join(__dirname, "../../../src/API/images"), // Another possible source location
  path.join(process.resourcesPath || "", "src/API/images"), // Electron resourcesPath
  path.join(process.cwd(), "src/API/images"),      // Current working directory
  path.join(process.cwd(), "images"),              // CWD/images
  path.join(path.dirname(process.execPath || ""), "resources", "src/API/images") // Next to executable
];

// Try to find the first path that exists
let imagesPath = null;

for (const testPath of possibleImagePaths) {
  try {
    console.log(`Checking path: ${testPath}`);
    if (fs.existsSync(testPath)) {
      imagesPath = testPath;
      console.log(`Found images directory at: ${imagesPath}`);
      break;
    }
  } catch (err) {
    console.log(`Error checking path ${testPath}: ${err.message}`);
  }
}

// If no path was found, create one
if (!imagesPath) {
  // Try to create the directory in a few different locations
  const fallbackPaths = [
    path.join(__dirname, "images"),
    path.join(process.cwd(), "images"),
    path.join(path.dirname(process.execPath || ""), "images")
  ];

  for (const tryPath of fallbackPaths) {
    try {
      console.log(`Attempting to create images directory at: ${tryPath}`);
      fs.mkdirSync(tryPath, { recursive: true });
      imagesPath = tryPath;
      console.log(`Created and using images directory at: ${imagesPath}`);
      break;
    } catch (err) {
      console.error(`Failed to create directory at ${tryPath}: ${err.message}`);
    }
  }

  // If still no path, use a fallback
  if (!imagesPath) {
    imagesPath = path.join(__dirname, "images");
    console.log(`Warning: Using default images path ${imagesPath} even though it doesn't exist`);
  }
}

console.log(`Final images directory path: ${imagesPath}`);

// If the images directory exists, list its contents
if (fs.existsSync(imagesPath)) {
  try {
    const files = fs.readdirSync(imagesPath);
    console.log(`Images directory contains ${files.length} files`);
    if (files.length > 0) {
      console.log(`Image examples: ${files.slice(0, 5).join(", ")}${files.length > 5 ? '...' : ''}`);
    }
  } catch (err) {
    console.error(`Error reading images directory: ${err.message}`);
  }
} else {
  console.log("Warning: Final images directory does not exist");
}

// Create a middleware to handle image requests with extensive logging
app.use("/API/images", (req, res, next) => {
  console.log(`Image request: ${req.path}`);

  const fullPath = path.join(imagesPath, req.path);
  console.log(`Full image path: ${fullPath}`);

  let fileExists = false;
  try {
    fileExists = fs.existsSync(fullPath);
  } catch (err) {
    console.error(`Error checking if file exists: ${err.message}`);
  }

  console.log(`File exists: ${fileExists ? 'YES' : 'NO'}`);

  if (!fileExists) {
    // Return a 404 for non-existent images
    return res.status(404).send('Image not found');
  }

  // Continue to the static middleware if file exists
  next();
}, express.static(imagesPath));

// API routes - with much better error handling
app.post("/api/save-images", async (req, res) => {
  console.log("Received save-images request");
  try {
    const result = await checkAndSaveImages();
    res.status(200).send(result || "Images refreshed successfully");
  } catch (error) {
    console.error("Error during image refresh:", error);
    res.status(500).send({
      error: "Failed to refresh images",
      message: error.message,
      stack: error.stack
    });
  }
});

// Improved email fetching endpoint with better error handling
app.get("/fetch-emails", async (req, res) => {
  console.log("Received fetch-emails request");
  try {
    // Add a timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Email fetch timeout after 30 seconds')), 30000)
    );

    // Race the email fetching against the timeout
    const result = await Promise.race([
      startFetchingEmails(),
      timeoutPromise
    ]);

    console.log("Email fetch completed successfully:", result);
    res.send(result || "Emails fetched successfully");
  } catch (error) {
    console.error("Error fetching emails:", error);
    // Send a more detailed error response
    res.status(500).json({
      error: "Failed to fetch emails",
      message: error.message,
      stack: error.stack
    });
  }
});

// Add a test endpoint to check if server is running
app.get("/test", (req, res) => {
  console.log("Test endpoint called");
  res.send("Server is running properly");
});

// Add a endpoint to list all available images
app.get("/api/list-images", (req, res) => {
  console.log("List images endpoint called");
  try {
    if (fs.existsSync(imagesPath)) {
      const files = fs.readdirSync(imagesPath);
      res.json({
        imagesPath,
        fileCount: files.length,
        files
      });
    } else {
      res.status(404).json({
        error: "Images directory not found",
        imagesPath
      });
    }
  } catch (err) {
    res.status(500).json({
      error: err.message,
      imagesPath
    });
  }
});

// Add an echo endpoint for quick testing
app.get("/echo", (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    query: req.query,
    message: "Server echo response"
  });
});

// Add a diagnostic endpoint
app.get("/diagnostic", (req, res) => {
  const info = {
    serverTime: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    architecture: process.arch,
    nodeEnv: process.env.NODE_ENV || 'development',
    currentDirectory: __dirname,
    workingDirectory: process.cwd(),
    execPath: process.execPath,
    pid: process.pid,
    memoryUsage: process.memoryUsage(),
    imagesPath: imagesPath,
    imagesExist: fs.existsSync(imagesPath)
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
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Something broke on the server',
    message: err.message,
    stack: err.stack
  });
});

// Add uncaught exception handler
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the server with better error handling
let serverInstance;
try {
  serverInstance = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log("============ SERVER STARTED ============");
  });

  serverInstance.on('error', (error) => {
    console.error(`Server error: ${error.message}`);
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use. Trying next port.`);
      // Try the next port
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
process.on('SIGTERM', shutDown);
process.on('SIGINT', shutDown);

function shutDown() {
  console.log('Received kill signal, shutting down gracefully');
  if (serverInstance) {
    serverInstance.close(() => {
      console.log('Closed out remaining connections');
      process.exit(0);
    });

    // Force close after 10s
    setTimeout(() => {
      console.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
}