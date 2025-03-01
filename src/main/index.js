const { app, shell, BrowserWindow, ipcMain } = require('electron');
const { join } = require('path');
const { electronApp, optimizer, is } = require('@electron-toolkit/utils');
const path = require('path');
const fs = require('fs');

// Express server integration
const express = require('express');
const cors = require('cors');
let serverApp = null;
let server = null;
const PORT = 5000;

// Create the main window
var mainWindow;

function createWindow() {
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
    ...(process.platform === "linux" ? { icon: path.join(__dirname, '../../resources/icon.png') } : {}),
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

// Start the Express server
function startExpressServer() {
  try {
    console.log("Starting Express server...");
    serverApp = express();

    // Enable CORS
    serverApp.use(cors());

    // Find the images directory
    let imagesPath;
    const possiblePaths = [
      path.join(__dirname, "../../src/API/images"),
      path.join(app.getAppPath(), "src/API/images"),
      path.join(process.resourcesPath, "src/API/images"),
      path.join(__dirname, "../../../src/API/images")
    ];

    for (const testPath of possiblePaths) {
      if (fs.existsSync(testPath)) {
        imagesPath = testPath;
        console.log(`Found images directory: ${imagesPath}`);
        break;
      }
    }

    // Create images directory if it doesn't exist
    if (!imagesPath) {
      imagesPath = path.join(__dirname, "images");
      try {
        fs.mkdirSync(imagesPath, { recursive: true });
        console.log(`Created images directory: ${imagesPath}`);
      } catch (err) {
        console.error(`Failed to create images directory: ${err.message}`);
      }
    }

    // Serve static images
    serverApp.use("/API/images", express.static(imagesPath));

    // Test endpoint
    serverApp.get("/test", (req, res) => {
      res.send("Server is running!");
    });

    // Mock endpoints for your actual API
    serverApp.post("/api/save-images", (req, res) => {
      console.log("Received request to save images");
      res.status(200).send({ success: true, message: "Images refreshed" });
    });

    serverApp.get("/fetch-emails", (req, res) => {
      console.log("Received request to fetch emails");
      res.status(200).send({ success: true, message: "Emails fetched" });
    });

    // Start listening
    server = serverApp.listen(PORT, () => {
      console.log(`Express server running on port ${PORT}`);
    });

    // Handle server errors
    server.on('error', (err) => {
      console.error(`Express server error: ${err.message}`);

      // Try another port if this one is in use
      if (err.code === 'EADDRINUSE') {
        console.log(`Port ${PORT} is in use, trying port ${PORT + 1}`);
        server = serverApp.listen(PORT + 1);
      }
    });

    return true;
  } catch (err) {
    console.error(`Failed to start Express server: ${err.message}`);
    return false;
  }
}

// App initialization
app.whenReady().then(() => {
  // Start Express server first
  startExpressServer();

  electronApp.setAppUserModelId("com.electron");

  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // Create the window
  createWindow();

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
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
  // Close the Express server if it's running
  if (server) {
    server.close(() => {
      console.log("Express server closed");
    });
  }
  app.quit();
});

// App quit handling
app.on("quit", () => {
  // Close the Express server if it's running
  if (server) {
    server.close();
  }
  app.exit(0);
});