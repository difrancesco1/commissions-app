"use strict";
const electron = require("electron");
const path = require("path");
const utils = require("@electron-toolkit/utils");
const { exec, spawn } = require("child_process");
const icon = path.join(__dirname, "../../resources/icon.png");
const scriptPath = path.join(__dirname, "../../src/API/server.js");
let mainWindow;
let backendProcess;

// Function to kill any process using the specified port (5000) before starting the backend
function killPort(port) {
  return new Promise((resolve) => {
    const cmd =
      process.platform === "win32"
        ? `netstat -ano | findstr :${port}`
        : `lsof -ti:${port}`;
    exec(cmd, (err, stdout) => {
      if (!err && stdout) {
        const pid =
          process.platform === "win32"
            ? stdout.trim().split(/\s+/).pop()
            : stdout.trim();
        if (pid) {
          const killCmd =
            process.platform === "win32"
              ? `taskkill /PID ${pid} /F`
              : `kill -9 ${pid}`;
          exec(killCmd, (killErr) => {
            if (killErr) {
              console.error(
                `Error killing process on port ${port}: ${killErr}`,
              );
            } else {
              console.log(`Process ${pid} terminated`);
            }
            resolve();
          });
        } else {
          console.log(`No process found on port ${port}`);
          resolve();
        }
      } else {
        console.log(`No process found on port ${port}`);
        resolve();
      }
    });
  });
}

function startBackend(scriptPath, retries = 5) {
  return new Promise((resolve, reject) => {
    backendProcess = spawn("node", [scriptPath], {
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    });
    console.log("Attempting to start backend server...");

    backendProcess.stdout.on("data", (data) => {
      console.log(`Server Output: ${data.toString()}`);
      if (data.toString().includes("Server is running on")) {
        resolve(); // Resolve when the server starts successfully
      }
    });

    backendProcess.stderr.on("data", (data) => {
      console.error(`Server Error: ${data.toString()}`);
    });

    backendProcess.on("error", (err) => {
      console.error(`Failed to start backend: ${err}`);
      reject(err); // Reject the promise on error
    });

    backendProcess.on("exit", (code) => {
      console.log(`Backend exited with code ${code}`);
      if (code !== 0 && retries > 0) {
        console.log("Retrying to start backend...");
        setTimeout(() => {
          startBackend(scriptPath, retries - 1)
            .then(resolve)
            .catch(reject);
        }, 2000); // Wait 2 seconds before retrying
      } else {
        reject(new Error(`Backend process exited with code ${code}`));
      }
    });
  });
}

function createWindow() {
  console.log(`Resolved script path: ${scriptPath}`);
  mainWindow = new electron.BrowserWindow({
    width: 322,
    height: 533,
    show: false,
    frame: false,
    transparent: true,
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

  // Kill any process using port 5000, then start the backend
  killPort(5000).then(() => {
    console.log("Port 5000 is free, starting backend server...");
    startBackend(scriptPath)
      .then(() => {
        mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
      })
      .catch((err) => {
        console.error("Failed to start the backend server:", err);
      });
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    electron.shell.openExternal(details.url);
    return { action: "deny" };
  });

  if (utils.is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

// backend stops when Electron closes
electron.app.whenReady().then(() => {
  utils.electronApp.setAppUserModelId("com.electron");
  electron.app.on("browser-window-created", (_, window) => {
    utils.optimizer.watchWindowShortcuts(window);
  });
  electron.ipcMain.on("ping", () => console.log("pong"));
  createWindow();
  electron.app.on("activate", function () {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// backend stops when Electron closes
electron.app.on("window-all-closed", () => {
  if (backendProcess) {
    backendProcess.kill("SIGTERM");
    backendProcess = null;
  }
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});

electron.app.on("before-quit", () => {
  if (backendProcess) {
    backendProcess.kill("SIGTERM");
  }
});

electron.ipcMain.on("app-close", () => {
  if (backendProcess) {
    backendProcess.kill();
  }
  killPort(5000).then(() => {
    electron.app.quit();
  });
});

electron.ipcMain.on("open-devtools", () => {
  mainWindow.webContents.openDevTools();
});
