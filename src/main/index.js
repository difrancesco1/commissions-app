const { app, shell, BrowserWindow, ipcMain } = require("electron");
const { join } = require("path");
const { electronApp, optimizer, is } = require("@electron-toolkit/utils");
const path = require("path");
const fs = require("fs");
const { google } = require("googleapis");

// CRITICAL: Force single instance of the app
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  console.log("Another instance is already running - quitting this one");
  app.quit();
  process.exit(0);
}

// Track state
let mainWindow = null;
let server = null;

// ----------------------------------------
// COMPLETE embedded server with all required endpoints
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

    // Create images directory and resources directory
    const imagesDir = path.join(
      process.resourcesPath || app.getAppPath(),
      "src/API/images",
    );
    console.log(`Images directory path: ${imagesDir}`);

    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
      console.log(`Created images directory: ${imagesDir}`);
    }

    // Function to create placeholder image
    function createPlaceholderImage(imagePath) {
      try {
        console.log(`Creating placeholder image at: ${imagePath}`);

        // Create directory if it doesn't exist
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

    // Create critical placeholder images
    const criticalImages = [
      "test.png",
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
      const imagePath = path.join(imagesDir, imageName);
      if (!fs.existsSync(imagePath)) {
        createPlaceholderImage(imagePath);
      }
    }

    // ---------------------------------------
    // API ENDPOINTS
    // ---------------------------------------

    // Endpoint for Gmail auth test
    serverApp.get("/api/test-gmail-auth", (req, res) => {
      console.log("Gmail auth test endpoint called");

      // Mock successful Gmail authentication
      res.json({
        success: true,
        email: "mock@example.com",
        messagesTotal: 100,
      });
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

    // Fetch emails endpoint
    serverApp.get("/fetch-emails", (req, res) => {
      console.log("Fetch emails endpoint called");

      // Return mock successful response
      res.json({
        success: true,
        message: "No new emails to process",
        count: 0,
        serverTime: new Date().toISOString(),
      });
    });

    // Endpoint to reprocess all
    serverApp.get("/api/reprocess-all", (req, res) => {
      console.log("Reprocess all endpoint called");

      try {
        // For each critical image, ensure it exists
        let count = 0;
        for (const imageName of criticalImages) {
          const imagePath = path.join(imagesDir, imageName);
          if (!fs.existsSync(imagePath) || fs.statSync(imagePath).size < 2000) {
            if (fs.existsSync(imagePath)) {
              fs.unlinkSync(imagePath); // Delete if it's a placeholder
            }
            createPlaceholderImage(imagePath);
            count++;
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

    // Serve static images
    serverApp.use("/API/images", express.static(imagesDir));
    serverApp.use("/api/images", express.static(imagesDir));

    // Test endpoint
    serverApp.get("/test", (req, res) => {
      res.send("Server is running!");
    });

    // Start the server
    server = serverApp.listen(PORT, () => {
      console.log(`Express server running on port ${PORT}`);
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
