const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const app = express();
const port = 5000;

// Enable CORS
app.use(cors());

// Basic route that responds with a simple message
app.get("/", (req, res) => {
  res.send("Server is running!");
});

// Test route
app.get("/test", (req, res) => {
  res.send("Test endpoint works!");
});

// ===== SIMPLIFIED IMAGE HANDLING =====
// Create or find images directory
const imagesDir = path.join(__dirname, "images");
console.log(`Using images directory: ${imagesDir}`);

try {
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
    console.log(`Created images directory at: ${imagesDir}`);
  } else {
    console.log(`Found existing images directory at: ${imagesDir}`);
  }
} catch (err) {
  console.error(`Error with images directory: ${err.message}`);
}

// Create test images with different naming patterns
try {
  // Create test.png
  const testImagePath = path.join(imagesDir, "test.png");
  const testPngData = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  fs.writeFileSync(testImagePath, testPngData);
  console.log(`Created test image at: ${testImagePath}`);

  // Create A03testuser.png (format used by your app)
  const appTestImagePath = path.join(imagesDir, "A03testuser.png");
  fs.writeFileSync(appTestImagePath, testPngData);
  console.log(`Created test user image at: ${appTestImagePath}`);
} catch (err) {
  console.error(`Error creating test images: ${err.message}`);
}

// ===== SIMPLIFIED STATIC FILE SERVING =====
// Serve the images directory through both /API/images and /api/images routes
app.use(["/API/images", "/api/images"], express.static(imagesDir));

// Also serve directly from /images for testing
app.use("/images", express.static(imagesDir));

// Add a diagnostic endpoint
app.get("/diagnostic", (req, res) => {
  try {
    const files = fs.existsSync(imagesDir) ? fs.readdirSync(imagesDir) : [];

    res.json({
      serverTime: new Date().toISOString(),
      imagesPath: imagesDir,
      imagesExist: fs.existsSync(imagesDir),
      imageCount: files.length,
      images: files,
      routes: {
        testImage1: "/images/test.png",
        testImage2: "/API/images/test.png",
        testImage3: "/api/images/test.png",
        testAppImage1: "/API/images/A03testuser.png",
        testAppImage2: "/api/images/A03testuser.png",
      },
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
      stack: err.stack,
    });
  }
});

// Add an image list endpoint
app.get("/api/list-images", (req, res) => {
  try {
    const files = fs.existsSync(imagesDir) ? fs.readdirSync(imagesDir) : [];
    res.json({
      imageCount: files.length,
      images: files,
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`Test images should be available at:`);
  console.log(` - http://localhost:${port}/images/test.png`);
  console.log(` - http://localhost:${port}/API/images/test.png`);
  console.log(` - http://localhost:${port}/api/images/test.png`);
  console.log(` - http://localhost:${port}/API/images/A03testuser.png`);
  console.log(
    `Diagnostic info available at: http://localhost:${port}/diagnostic`,
  );
});
