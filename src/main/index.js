import { app, shell, BrowserWindow, ipcMain } from "electron";
import { join } from "path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import icon from "../../resources/icon.png?asset";
import "./styles.css";
import rosieunaIcon from "../assets/rosieuna_icon.ico";
const path = require("path");
const { exec } = require("child_process");

function createWindow() {
  const scriptPath = path.join(__dirname, "../../src/API/server.js"); // Adjust path as needed

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 322,
    height: 533,
    show: false,
    frame: false, // Remove the window frame
    transparent: true, // Allow transparency for rounded corners
    titleBarStyle: "hidden",
    resizable: false,
    autoHideMenuBar: true,
    fullscreenable: false,
    icon: `${__dirname}/dist/assets/imgs/logo.png`,
    ...(process.platform === "linux" ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, rosieunaIcon),
      sandbox: false,
      nodeIntegration: true,
      enableRemoteModule: true,
      contextIsolation: false,
    },
  });

  exec(`node ${scriptPath}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing script: ${error}`);
      return;
    }
    console.log(`stdout: ${stdout}`);
    console.error(`stderr: ${stderr}`);
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

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId("com.electron");

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // IPC test
  ipcMain.on("ping", () => console.log("pong"));

  createWindow();

  app.on("activate", function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.on("app-close", () => {
  app.quit();
});

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
