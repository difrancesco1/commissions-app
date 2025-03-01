const { app, shell, BrowserWindow, ipcMain } = require('electron');
const { join } = require('path');
const { electronApp, optimizer, is } = require('@electron-toolkit/utils');
const path = require('path');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const treeKill = require('tree-kill');

var mainWindow;
let serverProcess = null;

// Wait a bit before creating the window to allow the server to start
const WINDOW_CREATION_DELAY = 3000; // ms

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
      webSecurity: false, // Allow loading local files directly
    },
  });

  // Open DevTools for debugging
  // mainWindow.webContents.openDevTools({ mode: 'detach' });

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

  // Add event listener for page load errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Page failed to load:', errorCode, errorDescription);
  });
}

// Function to find the server script with more logging
function findServerScript() {
  console.log("Finding server script...");
  console.log("App path:", app.getAppPath());
  console.log("__dirname:", __dirname);
  console.log("process.resourcesPath:", process.resourcesPath);

  const possiblePaths = [
    // Dev paths
    path.join(__dirname, "../../src/API/server.js"),

    // Production paths
    path.join(app.getAppPath(), "src/API/server.js"),
    path.join(process.resourcesPath, "app.asar/src/API/server.js"),
    path.join(process.resourcesPath, "app/src/API/server.js"),
    path.join(process.resourcesPath, "src/API/server.js"),

    // Extra paths based on your specific packaging
    path.join(app.getAppPath(), "out/src/API/server.js"),
    path.join(__dirname, "../../../src/API/server.js"),

    // Check extraResources paths
    path.join(process.resourcesPath, "src/API/server.js")
  ];

  // Look for the first path that exists and log all paths
  for (const testPath of possiblePaths) {
    const exists = fs.existsSync(testPath);
    console.log(`Path: ${testPath}, Exists: ${exists}`);
    if (exists) {
      console.log(`Found server script at: ${testPath}`);
      return testPath;
    }
  }

  console.error("Could not find server.js in any expected location");

  // Fall back to the first path as last resort
  return possiblePaths[0];
}

// Enhanced server startup function
function startServer() {
  const scriptPath = findServerScript();

  console.log(`Starting server from: ${scriptPath}`);
  console.log(`Script exists: ${fs.existsSync(scriptPath)}`);

  try {
    // Log the script content for debugging
    if (fs.existsSync(scriptPath)) {
      const scriptContent = fs.readFileSync(scriptPath, 'utf8');
      console.log(`First 200 characters of script: ${scriptContent.substring(0, 200)}...`);
    }

    // Add debug flags to Node process
    serverProcess = spawn('node', ['--trace-warnings', scriptPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
      env: {
        ...process.env,
        DEBUG: '*', // Enable debug output
        NODE_ENV: 'production'
      }
    });

    if (serverProcess && serverProcess.pid) {
      console.log(`Server started with PID: ${serverProcess.pid}`);

      // Log stdout and stderr with better formatting
      serverProcess.stdout.on('data', (data) => {
        const output = data.toString().trim();
        console.log(`Server stdout: ${output}`);
      });

      serverProcess.stderr.on('data', (data) => {
        const output = data.toString().trim();
        console.error(`Server stderr: ${output}`);
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

// App initialization
app.whenReady().then(() => {
  // Register IPC handlers
  // This is the key fix - make sure this runs before window creation
  console.log("Registering IPC handlers...");

  // Handle requests for image paths
  ipcMain.handle('get-image-path', (event, imageName) => {
    console.log(`Requested image: ${imageName}`);

    // Try various possible locations for the image
    const possiblePaths = [
      // Development paths
      path.join(app.getAppPath(), 'src/API/images', imageName),
      path.join(__dirname, '../../src/API/images', imageName),

      // Production paths
      path.join(process.resourcesPath, 'src/API/images', imageName),
      path.join(process.resourcesPath, 'app.asar/src/API/images', imageName),

      // Extra resource paths
      path.join(process.resourcesPath, 'app/src/API/images', imageName)
    ];

    // Check each path and return the first one that exists
    for (const imgPath of possiblePaths) {
      console.log(`Checking path: ${imgPath}`);
      if (fs.existsSync(imgPath)) {
        console.log(`Found image at: ${imgPath}`);
        return `file://${imgPath}`; // Return with file:// protocol
      }
    }

    console.error(`Image not found: ${imageName}`);
    return null;
  });

  // Add a handler to list all available images for debugging
  ipcMain.handle('list-available-images', () => {
    console.log("List-available-images called");
    const possibleDirs = [
      path.join(app.getAppPath(), 'src/API/images'),
      path.join(__dirname, '../../src/API/images'),
      path.join(process.resourcesPath, 'src/API/images'),
      path.join(process.resourcesPath, 'app.asar/src/API/images')
    ];

    const results = [];

    for (const dir of possibleDirs) {
      console.log(`Checking directory: ${dir}`);
      if (fs.existsSync(dir)) {
        console.log(`Found images directory at: ${dir}`);
        try {
          const files = fs.readdirSync(dir);
          console.log(`Available images (${files.length}): ${files.join(', ')}`);
          results.push({ directory: dir, exists: true, files });
        } catch (err) {
          console.error(`Error reading directory: ${err}`);
          results.push({ directory: dir, exists: true, files: [], error: err.message });
        }
      } else {
        results.push({ directory: dir, exists: false, files: [] });
      }
    }

    return results;
  });

  // Simple ping handler to test IPC
  ipcMain.handle('ping', () => {
    console.log("Ping received");
    return "pong";
  });

  electronApp.setAppUserModelId("com.electron");

  // Default open or close DevTools by F12 in development
  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // IPC test
  ipcMain.on("ping", () => console.log("pong"));

  // Start the server first
  console.log("Starting server process...");
  const serverStarted = startServer();
  console.log(`Server start ${serverStarted ? 'succeeded' : 'failed'}`);

  // Wait longer for the server to initialize before creating the window
  console.log(`Waiting ${WINDOW_CREATION_DELAY}ms before creating window...`);
  setTimeout(() => {
    console.log("Creating window...");
    createWindow();
  }, WINDOW_CREATION_DELAY);

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Window close handling
app.on("window-all-closed", async () => {
  if (process.platform !== "darwin") {
    await killServer();
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
ipcMain.on("app-close", async () => {
  await killServer();
  app.quit();
});

// Quit handling
app.on("quit", async () => {
  mainWindow = null;
  await killServer();
  app.exit(0);
});