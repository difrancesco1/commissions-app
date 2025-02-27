import { app, shell, BrowserWindow, ipcMain } from "electron";
import { join } from "path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import icon from "../../resources/icon.png?asset";
import "./styles.css";
const path = require("path");
const { exec, spawn } = require("child_process");
const fs = require('fs');
const treeKill = require('tree-kill'); // You already have this in your dependencies
var mainWindow;
let serverProcess = null;

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 322,
    height: 533,
    show: false,
    frame: false, // Remove the window frame
    transparent: true, // Allow transparency for rounded corners
    titleBarStyle: "hidden",
    resizable: false,
    autoHideMenuBar: true,
    fullscreenable: false,
    ...(process.platform === "linux" ? { icon } : {}),
    webPreferences: {
      sandbox: false,
      nodeIntegration: true,
      enableRemoteModule: true,
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
  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

// Function to find the server script
function findServerScript() {
  const possiblePaths = [
    // Dev paths
    path.join(__dirname, "../../src/API/server.js"),

    // Production paths - based on electron-builder and electron-vite
    path.join(app.getAppPath(), "src/API/server.js"),
    path.join(app.getAppPath(), "../src/API/server.js"),
    path.join(process.resourcesPath, "app.asar/src/API/server.js"),
    path.join(process.resourcesPath, "src/API/server.js"),

    // Additional paths based on your package.json configuration
    path.join(app.getAppPath(), "out/src/API/server.js"),
    path.join(__dirname, "../../../src/API/server.js")
  ];

  // Look for the first path that exists
  for (const testPath of possiblePaths) {
    console.log(`Checking path: ${testPath}`);
    if (fs.existsSync(testPath)) {
      console.log(`Found server script at: ${testPath}`);
      return testPath;
    }
  }

  console.error("Could not find server.js in any expected location");
  console.log("Current directory:", __dirname);
  console.log("App path:", app.getAppPath());
  console.log("Resources path:", process.resourcesPath);

  // Fall back to the first path as last resort
  return possiblePaths[0];
}

// Function to start the server with improved spawn approach
function startServer() {
  const scriptPath = findServerScript();

  console.log(`Starting server from: ${scriptPath}`);

  try {
    // Using spawn instead of exec for better process handling
    serverProcess = spawn('node', [scriptPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false
    });

    if (serverProcess && serverProcess.pid) {
      console.log(`Server started with PID: ${serverProcess.pid}`);

      // Log stdout and stderr
      serverProcess.stdout.on('data', (data) => {
        console.log(`Server stdout: ${data}`);
      });

      serverProcess.stderr.on('data', (data) => {
        console.error(`Server stderr: ${data}`);
      });

      // Handle server process exit
      serverProcess.on('exit', (code) => {
        console.log(`Server process exited with code ${code}`);
        serverProcess = null;
      });

      serverProcess.on('error', (err) => {
        console.error(`Failed to start server process: ${err}`);
        serverProcess = null;
      });

      return true;
    } else {
      console.error("Failed to start server process - no PID returned");
      return false;
    }
  } catch (error) {
    console.error(`Exception starting server: ${error}`);
    return false;
  }
}

// Function to properly kill the server
function killServer() {
  return new Promise((resolve) => {
    if (!serverProcess) {
      console.log("No server process to kill");
      resolve();
      return;
    }

    const pid = serverProcess.pid;
    console.log(`Killing server process with PID: ${pid}`);

    // Use tree-kill for reliable cross-platform process killing
    treeKill(pid, 'SIGTERM', (err) => {
      if (err) {
        console.error(`Failed to kill process: ${err}`);

        // Fallback to platform-specific solutions
        if (process.platform === 'win32') {
          exec(`taskkill /pid ${pid} /T /F`, () => {
            serverProcess = null;
            resolve();
          });
        } else {
          try {
            process.kill(pid, 'SIGKILL');
          } catch (e) {
            console.error(`Final kill attempt failed: ${e}`);
          }
          serverProcess = null;
          resolve();
        }
      } else {
        console.log(`Process ${pid} successfully killed`);
        serverProcess = null;
        resolve();
      }
    });

    // Set a timeout to force resolve if the kill is taking too long
    setTimeout(() => {
      if (serverProcess) {
        console.log("Kill operation timed out, forcing resolution");
        serverProcess = null;
      }
      resolve();
    }, 3000);
  });
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId("com.electron");

  // Default open or close DevTools by F12 in development
  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // IPC test
  ipcMain.on("ping", () => console.log("pong"));

  // Start the server first
  const serverStarted = startServer();
  console.log(`Server start ${serverStarted ? 'succeeded' : 'failed'}`);

  // Wait a moment for the server to initialize before creating the window
  setTimeout(() => {
    createWindow();
  }, 1000);

  app.on("activate", function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS
app.on("window-all-closed", async () => {
  if (process.platform !== "darwin") {
    await killServer();
    app.quit();
  }
});

ipcMain.on("open-devtools", () => {
  mainWindow.webContents.openDevTools();
});

ipcMain.on("app-close", async () => {
  await killServer();
  app.quit();
});

app.on("quit", async () => {
  mainWindow = null;
  await killServer();
  app.exit(0);
});

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.