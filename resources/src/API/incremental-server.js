// incremental-server.js
const express = require("express");
const path = require("path");
const fs = require("fs");
const app = express();
const port = 5000;

// Basic route that responds with a simple message
app.get("/", (req, res) => {
  res.send("Incremental server is running!");
});

// Test route
app.get("/test", (req, res) => {
  res.send("Test endpoint works!");
});

// Create images directory and test image
const imagesDir = path.join(__dirname, "images");
try {
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
    console.log(`Created images directory at: ${imagesDir}`);
  }

  const testImagePath = path.join(imagesDir, "test.png");
  const testPngData = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  fs.writeFileSync(testImagePath, testPngData);
  console.log(`Created test image at: ${testImagePath}`);
} catch (err) {
  console.error(`Error creating test image: ${err.message}`);
}

// Simple static file serving
app.use("/images", express.static(imagesDir));

// Diagnostic endpoint
app.get("/diagnostic", (req, res) => {
  const info = {
    serverTime: new Date().toISOString(),
    imagesPath: imagesDir,
    imagesExist: fs.existsSync(imagesDir),
  };

  try {
    if (info.imagesExist) {
      const files = fs.readdirSync(imagesDir);
      info.imageCount = files.length;
      info.images = files;
    }
  } catch (err) {
    info.error = err.message;
  }

  res.json(info);
});

// Start the server
app.listen(port, () => {
  console.log(`Incremental server running at http://localhost:${port}`);
  console.log(
    `Test image should be available at: http://localhost:${port}/images/test.png`,
  );
  console.log(
    `Diagnostic info available at: http://localhost:${port}/diagnostic`,
  );
});
