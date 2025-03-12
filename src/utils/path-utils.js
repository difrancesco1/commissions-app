const path = require("path");
const fs = require("fs");
const { app } = require("electron");

// Get the correct app path depending on dev or production
function getAppPath() {
  return process.env.NODE_ENV === "development"
    ? process.cwd()
    : path.dirname(app.getPath("exe"));
}

// Get path to resources
function getResourcePath() {
  return process.env.NODE_ENV === "development"
    ? process.cwd()
    : process.resourcesPath;
}

// Resolve a path to a resource file
function resolveResourcePath(relativePath) {
  // Try multiple possible locations to find the file
  const possiblePaths = [
    path.join(getResourcePath(), relativePath),
    path.join(getAppPath(), relativePath),
    path.join(process.cwd(), relativePath),
  ];

  for (const tryPath of possiblePaths) {
    if (fs.existsSync(tryPath)) {
      return tryPath;
    }
  }

  // Default fallback
  return path.join(getResourcePath(), relativePath);
}

module.exports = {
  getAppPath,
  getResourcePath,
  resolveResourcePath,
};
