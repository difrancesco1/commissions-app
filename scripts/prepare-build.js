const fs = require("fs");
const path = require("path");

console.log("Preparing build...");

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

// Prepare for build
const prepareForBuild = () => {
  // Ensure directories exist
  ensureDirExists("./out");
  ensureDirExists("./out/main");
  ensureDirExists("./out/renderer");
  ensureDirExists("./resources");

  // Create API directory in resources
  ensureDirExists("./resources/src/API");
  ensureDirExists("./resources/src/API/images");

  // Check if API directory exists
  if (fs.existsSync("./src/API")) {
    console.log("Copying API directory to resources...");
    copyDir("./src/API", "./resources/src/API");
  } else {
    console.warn("API directory not found in src/API");
  }

  console.log("Build preparation complete!");
};

// Run the preparation
prepareForBuild();
