const { app, shell, BrowserWindow, ipcMain } = require("electron");
const { join } = require("path");
const { electronApp, optimizer, is } = require("@electron-toolkit/utils");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

// Track server process
let serverProcess = null;
let mainWindow = null;

// Start the Express server as a separate process
function startExpressServer() {
  console.log("Starting Express server...");

  // Path to the server file - try different locations
  const serverPaths = [
    path.join(__dirname, "../../src/API/fix-server.js"),
    path.join(__dirname, "../src/API/fix-server.js"),
    path.join(process.resourcesPath, "src/API/fix-server.js"),
    path.join(__dirname, "fix-server.js"),
  ];

  let serverFilePath = null;
  for (const testPath of serverPaths) {
    if (fs.existsSync(testPath)) {
      serverFilePath = testPath;
      console.log(`Found server script at: ${serverFilePath}`);
      break;
    }
  }

  if (!serverFilePath) {
    console.error("Server script not found!");
    return false;
  }

  try {
    // Use spawn instead of fork for better error handling
    serverProcess = spawn(process.execPath, [serverFilePath], {
      stdio: "inherit",
      env: process.env,
    });

    serverProcess.on("error", (err) => {
      console.error("Failed to start server process:", err);
    });

    // Wait a bit to let the server start
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log("Express server started");
        resolve(true);
      }, 1000);
    });
  } catch (err) {
    console.error(`Failed to start Express server: ${err.message}`);
    return Promise.resolve(false);
  }
}

// Helper function to create placeholder image
function createPlaceholderImage(imagePath) {
  try {
    console.log(`Creating placeholder image at: ${imagePath}`);

    // Create directory if it doesn't exist
    const dir = path.dirname(imagePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 1x1 pixel transparent PNG data
    const placeholderData = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );

    fs.writeFileSync(imagePath, placeholderData);
    return true;
  } catch (error) {
    console.error(`Error creating placeholder image: ${error.message}`);
    return false;
  }
}

// Function to ensure critical images exist
function ensureCriticalImagesExist() {
  console.log("Ensuring critical images exist...");

  // Find the images directory
  const possiblePaths = [
    path.join(__dirname, "../../src/API/images"),
    path.join(__dirname, "../src/API/images"),
    path.join(process.resourcesPath, "src/API/images"),
  ];

  let imagesPath = null;
  for (const testPath of possiblePaths) {
    if (fs.existsSync(testPath)) {
      imagesPath = testPath;
      break;
    }
  }

  // Create directory if it doesn't exist
  if (!imagesPath) {
    imagesPath = path.join(__dirname, "../../src/API/images");
    try {
      fs.mkdirSync(imagesPath, { recursive: true });
    } catch (err) {
      console.error(`Failed to create images directory: ${err.message}`);
      return;
    }
  }

  // List of critical images that should always exist
  const criticalImages = [
    "test.png",
    "A03Muraminalol.png",
    // Other critical images
  ];

  for (const imageName of criticalImages) {
    const imagePath = path.join(imagesPath, imageName);
    if (!fs.existsSync(imagePath)) {
      console.log(`Creating missing critical image: ${imageName}`);
      createPlaceholderImage(imagePath);
    }
  }
}

// Create the main window
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
    ...(process.platform === "linux"
      ? { icon: path.join(__dirname, "../../resources/icon.png") }
      : {}),
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
  // Start Express server first and wait for it to be ready
  await startExpressServer();

  // Ensure critical images exist
  ensureCriticalImagesExist();

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
  // Kill the server process if it's running
  if (serverProcess) {
    try {
      serverProcess.kill();
    } catch (err) {
      console.error("Error killing server process:", err);
    }
  }
  app.quit();
});

// App quit handling
app.on("quit", () => {
  // Kill the server process if it's running
  if (serverProcess) {
    try {
      serverProcess.kill();
    } catch (err) {
      console.error("Error killing server process:", err);
    }
  }
  app.exit(0);
});
