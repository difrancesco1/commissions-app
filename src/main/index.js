"use strict";
const electron = require("electron");
const path = require("path");
const utils = require("@electron-toolkit/utils");
const { exec, spawn } = require("child_process");
const icon = path.join(__dirname, "../../resources/icon.png");
const scriptPath = path.join(__dirname, "../../src/API/server.js");
let mainWindow;
let backendProcess;

function checkPortInUse(port) {
  return new Promise((resolve) => {
    const cmd =
      process.platform === "win32"
        ? `netstat -ano | findstr :${port}`
        : `lsof -ti:${port}`;
    exec(cmd, (err, stdout) => {
      resolve(stdout.trim() !== "");
    });
  });
}

function killPort(port) {
  return new Promise((resolve) => {
    const cmd =
      process.platform === "win32"
        ? `netstat -ano | findstr :${port}`
        : `lsof -ti:${port}`;

    exec(cmd, (err, stdout) => {
      if (!err && stdout) {
        const pids = stdout.trim().split(/\s+/);
        const killCommands = pids.map((pid) => {
          return process.platform === "win32"
            ? `taskkill /PID ${pid} /F`
            : `kill -9 ${pid}`;
        });

        // Execute all kill commands
        killCommands.forEach((killCmd) => {
          exec(killCmd, (killErr) => {
            if (killErr) {
              console.error(`Error killing process: ${killErr}`);
            } else {
              console.log(`Killed process on port ${port}`);
            }
          });
        });

        // Wait a short time and then check if the port is free
        setTimeout(() => {
          checkPortInUse(port).then((inUse) => {
            if (inUse) {
              console.log(`Port ${port} is still in use. Retrying...`);
              killPort(port).then(resolve);
            } else {
              console.log(`Port ${port} is now free.`);
              resolve();
            }
          });
        }, 1000); // Adjust this timeout as needed
      } else {
        console.log(`No process found on port ${port}`);
        resolve();
      }
    });
  });
}

function startBackend(scriptPath2, retries = 5) {
  return new Promise((resolve, reject) => {
    backendProcess = spawn("node", [scriptPath2], {
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    });
    console.log("Attempting to start backend server...");
    backendProcess.stdout.on("data", (data) => {
      console.log(`Server Output: ${data.toString()}`);
      if (data.toString().includes("Server is running on")) {
        resolve();
      }
    });
    backendProcess.stderr.on("data", (data) => {
      console.error(`Server Error: ${data.toString()}`);
    });
    backendProcess.on("error", (err) => {
      console.error(`Failed to start backend: ${err}`);
      reject(err);
    });
    backendProcess.on("exit", (code) => {
      console.log(`Backend exited with code ${code}`);
      if (code !== 0 && retries > 0) {
        console.log("Retrying to start backend...");
        setTimeout(() => {
          startBackend(scriptPath2, retries - 1)
            .then(resolve)
            .catch(reject);
        }, 2000);
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
    backendProcess.kill("SIGTERM");
    backendProcess = null;
  }
  killPort(5000).then(() => {
    electron.app.quit();
  });
});

electron.ipcMain.on("open-devtools", () => {
  mainWindow.webContents.openDevTools();
});
