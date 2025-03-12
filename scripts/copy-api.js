const fs = require("fs");
const path = require("path");

console.log("Copying API files after build...");

// Ensure directories exist
const ensureDirExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  }
};

// Copy a file
const copyFile = (src, dest) => {
  try {
    fs.copyFileSync(src, dest);
    console.log(`Copied ${src} to ${dest}`);
  } catch (err) {
    console.error(`Error copying ${src} to ${dest}: ${err.message}`);
  }
};

// Copy a directory
const copyDir = (src, dest) => {
  ensureDirExists(dest);

  try {
    if (!fs.existsSync(src)) {
      console.warn(`Source directory does not exist: ${src}`);
      return;
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        copyDir(srcPath, destPath);
      } else {
        copyFile(srcPath, destPath);
      }
    }
  } catch (err) {
    console.error(`Error copying directory ${src} to ${dest}: ${err.message}`);
  }
};

// Copy API folder to output directory
const copyApiToOutput = () => {
  ensureDirExists("./out/main/src");
  ensureDirExists("./out/main/src/API");

  // Copy API files to output
  if (fs.existsSync("./src/API")) {
    copyDir("./src/API", "./out/main/src/API");
  } else {
    console.warn("src/API directory not found");
  }

  // Verify that fix-server.js is in the API folder
  const serverFile = "./out/main/src/API/fix-server.js";
  if (!fs.existsSync(serverFile)) {
    console.error(`WARNING: Server file not found in output: ${serverFile}`);

    // Try to copy it from resources if it exists there
    const resourceServerFile = "./resources/src/API/fix-server.js";
    if (fs.existsSync(resourceServerFile)) {
      copyFile(resourceServerFile, serverFile);
    } else {
      console.error("Could not find fix-server.js in any location!");
    }
  } else {
    console.log(`Server file verified: ${serverFile}`);
  }

  console.log("API copy complete!");
};

// Run the copy operation
copyApiToOutput();
