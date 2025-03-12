const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const { google } = require("googleapis");
const isPackaged = !process.env.NODE_ENV === "development";
const resourcesPath = isPackaged ? process.resourcesPath : process.cwd();

// Load required modules
let startFetchingEmails;
let checkAndSaveImages;
let downloadAttachmentFromGmail;
let findImagesDirectory;
let db;
let gmail;

// Load email fetching module
try {
  const scriptPath = path.join(__dirname, "script.js");
  const scriptModule = require(scriptPath);
  startFetchingEmails = scriptModule.startFetchingEmails;
} catch (err) {
  // Try alternative paths
  const alternativePaths = [
    path.join(process.cwd(), "script.js"),
    path.join(process.cwd(), "src/API/script.js"),
    path.join(__dirname, "../script.js"),
  ];

  for (const altPath of alternativePaths) {
    if (fs.existsSync(altPath)) {
      const scriptModule = require(altPath);
      startFetchingEmails = scriptModule.startFetchingEmails;
      break;
    }
  }

  // Create a mock function if not found
  if (!startFetchingEmails) {
    startFetchingEmails = async () => ({
      success: true,
      message: "Mock email fetch (module not available)",
    });
  }
}

// Load image saving module
try {
  const imageSavePath = path.join(__dirname, "imageSave.js");
  checkAndSaveImages = require(imageSavePath);

  // Get needed functions from module
  if (typeof checkAndSaveImages === "object") {
    downloadAttachmentFromGmail =
      checkAndSaveImages.downloadAttachmentFromGmail;
    findImagesDirectory = checkAndSaveImages.findImagesDirectory;
    db = checkAndSaveImages.db;
    gmail = checkAndSaveImages.gmail;
  }
} catch (err) {
  // Try alternative paths
  const alternativePaths = [
    path.join(process.cwd(), "imageSave.js"),
    path.join(process.cwd(), "src/API/imageSave.js"),
    path.join(__dirname, "../imageSave.js"),
  ];

  for (const altPath of alternativePaths) {
    if (fs.existsSync(altPath)) {
      checkAndSaveImages = require(altPath);
      break;
    }
  }

  // Create a mock function if not found
  if (!checkAndSaveImages) {
    checkAndSaveImages = async () => ({
      success: true,
      message: "Mock image save (module not available)",
    });
  }
}

// Create the Express app
const app = express();
const port = process.env.PORT || 5000;

// Enable CORS
app.use(cors());

// Find the images directory
let imagesPath = null;
const possibleImagePaths = [
  path.join(__dirname, "images"),
  path.join(__dirname, "../images"),
  path.join(process.resourcesPath || "", "src/API/images"),
  path.join(process.cwd(), "src/API/images"),
  path.join(process.cwd(), "images"),
];

// Find existing images directory
for (const testPath of possibleImagePaths) {
  try {
    if (fs.existsSync(testPath)) {
      imagesPath = testPath;
      break;
    }
  } catch (err) {
    // Skip if path not accessible
  }
}

// Create directory if not found
if (!imagesPath) {
  const fallbackPaths = [
    path.join(__dirname, "images"),
    path.join(process.cwd(), "images"),
  ];

  for (const tryPath of fallbackPaths) {
    try {
      fs.mkdirSync(tryPath, { recursive: true });
      imagesPath = tryPath;
      break;
    } catch (err) {
      // Skip if directory creation fails
    }
  }

  // Default path as fallback
  if (!imagesPath) {
    imagesPath = path.join(__dirname, "images");
  }
}

// Create a test image
if (imagesPath) {
  const testImagePath = path.join(imagesPath, "test.png");
  try {
    const testPngData = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    fs.writeFileSync(testImagePath, testPngData);
  } catch (err) {
    // Ignore test image creation failure
  }
}

// Get paths for token and credentials
function getTokenPath() {
  return findCredentialPath("token.json");
}

function getCredentialsPath() {
  return findCredentialPath("credentials.json");
}

// Helper function to create and serve a placeholder image with color
function createColoredPlaceholder(imagePath, res) {
  try {
    console.log(`Creating colored placeholder at: ${imagePath}`);

    // Make sure directory exists
    const dir = path.dirname(imagePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Create a blue colored placeholder image (50x50 PNG)
    const placeholderData = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAAABmJLR0QA/wD/AP+gvaeTAAAAnElEQVRoge3RAQ0AAAQAMCHa27Ay/GYMPJKqKyvvAAAAAAAAAAAAAAAAAAAAAAAAAAAAxCHqxseQIS0NaRoSGRIZ0tKQpiGRIZEhLQ1pGhIZEhnS0pCmIZEhkSEtDWkaEhkSGdLSkKYhkSGRIS0NaRoSGRIZ0tKQpiGRIZEhLQ1pGhIZEhnS0pCmIZEhkSEtDWkaEhkSGdLSkKYh+WzID/fgBFrDYFnyAAAAAElFTkSuQmCC",
      "base64",
    );

    fs.writeFileSync(imagePath, placeholderData);
    console.log(`Created placeholder image at: ${imagePath}`);

    // If response is provided, send the file
    if (res) {
      res.sendFile(imagePath);
    }
    return true;
  } catch (error) {
    console.error(`Error creating placeholder: ${error.message}`);
    if (res) {
      res.status(404).send("Image not found and could not create placeholder");
    }
    return false;
  }
}

// Function to ensure images are found and copied to the right location
function ensureImagesAreAvailable() {
  console.log("Ensuring images are available in the correct directory...");

  // Make sure the images directory exists
  if (!fs.existsSync(imagesPath)) {
    try {
      fs.mkdirSync(imagesPath, { recursive: true });
      console.log(`Created images directory at: ${imagesPath}`);
    } catch (err) {
      console.error(`Failed to create images directory: ${err.message}`);
      return false;
    }
  }

  // Find all image files across possible paths and copy them to the main path
  const processedFiles = [];

  for (const basePath of possibleImagePaths) {
    if (basePath === imagesPath) continue; // Skip if same as target

    try {
      if (fs.existsSync(basePath)) {
        const files = fs.readdirSync(basePath);

        files
          .filter((file) => file.endsWith(".png"))
          .forEach((file) => {
            const sourcePath = path.join(basePath, file);
            const targetPath = path.join(imagesPath, file);

            if (!fs.existsSync(targetPath)) {
              try {
                fs.copyFileSync(sourcePath, targetPath);
                processedFiles.push({
                  file,
                  from: basePath,
                  to: imagesPath,
                  success: true,
                });
              } catch (copyErr) {
                processedFiles.push({
                  file,
                  from: basePath,
                  to: imagesPath,
                  success: false,
                  error: copyErr.message,
                });
              }
            }
          });
      }
    } catch (err) {
      console.log(`Error accessing path ${basePath}: ${err.message}`);
    }
  }

  console.log(`Processed ${processedFiles.length} image files`);
  return processedFiles.length > 0;
}

// Call ensureImagesAreAvailable at server startup
ensureImagesAreAvailable();

// Add debug endpoint
app.get("/api/debug-image-paths", (req, res) => {
  // Collect all information about paths and file existence
  const pathInfo = {
    imagesPath,
    possiblePaths: possibleImagePaths,
    existingFiles: [],
    serverBasePath: __dirname,
    processCwd: process.cwd(),
    resourcesPath: process.resourcesPath || "Not available",
  };

  // List all files in the images directory
  try {
    if (fs.existsSync(imagesPath)) {
      pathInfo.existingFiles = fs.readdirSync(imagesPath);
    } else {
      pathInfo.error = "Images directory does not exist";
    }
  } catch (err) {
    pathInfo.error = err.message;
  }

  res.json(pathInfo);
});

// Add endpoint to create test image
app.get("/api/create-test-image", (req, res) => {
  const imageName = req.query.name || "test.png";

  // Make sure the images directory exists
  if (!fs.existsSync(imagesPath)) {
    try {
      fs.mkdirSync(imagesPath, { recursive: true });
    } catch (err) {
      return res.status(500).json({
        error: "Failed to create images directory",
        message: err.message,
      });
    }
  }

  // Create a simple test image
  const testImagePath = path.join(imagesPath, imageName);
  try {
    // This is a 1x1 pixel transparent PNG
    const testPngData = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    fs.writeFileSync(testImagePath, testPngData);

    res.json({
      success: true,
      message: `Test image created at ${testImagePath}`,
      path: testImagePath,
      url: `/API/images/${imageName}`,
    });
  } catch (err) {
    res.status(500).json({
      error: "Failed to create test image",
      message: err.message,
    });
  }
});

// Add manual endpoint to serve specific images
app.get("/direct-image/:filename", (req, res) => {
  const filename = req.params.filename;
  const imagePath = path.join(imagesPath, filename);

  if (fs.existsSync(imagePath)) {
    res.sendFile(imagePath);
  } else {
    // Create on demand
    createColoredPlaceholder(imagePath, res);
  }
});

// Enhanced middleware to handle missing images for the API/images route
app.use("/API/images/:filename", (req, res, next) => {
  const requestedFilename = req.params.filename;
  const fullPath = path.join(imagesPath, requestedFilename);

  // If the file exists, let the regular middleware handle it
  if (fs.existsSync(fullPath)) {
    return next();
  }

  console.log(
    `Image not found: ${requestedFilename}, checking alternatives...`,
  );

  // If create parameter is present, always create the image
  if (req.query.create === "true") {
    return createColoredPlaceholder(fullPath, res);
  }

  // For A03Username.png pattern, check if document ID exists
  // The ID would be in format A03Username or similar
  if (
    requestedFilename.startsWith("A03") &&
    requestedFilename.endsWith(".png")
  ) {
    // Extract the username
    const username = requestedFilename.substring(
      3,
      requestedFilename.length - 4,
    );
    console.log(`Extracted username: ${username}`);

    // Try different document ID patterns
    const possibleIDs = [
      `A03${username}`, // Direct ID match
      `A03${username.toLowerCase()}`, // Lowercase version
      `A03${username.toUpperCase()}`, // Uppercase version
    ];

    // Check if any of these files exist
    for (const id of possibleIDs) {
      const altPath = path.join(imagesPath, `${id}.png`);
      if (fs.existsSync(altPath)) {
        console.log(`Found alternative image at: ${altPath}`);
        return res.sendFile(altPath);
      }
    }

    // If we get here, we need to check the database for the correct ID
    try {
      // If we have access to the database, try to look up the document
      if (db) {
        console.log(`Checking database for username: ${username}`);
        db.collection("commissions")
          .where("TWITTER", "==", username)
          .get()
          .then((snapshot) => {
            if (!snapshot.empty) {
              // Found a matching document
              const doc = snapshot.docs[0];
              const correctID = doc.id;
              console.log(`Found document with ID: ${correctID}`);

              const correctPath = path.join(imagesPath, `${correctID}.png`);
              if (fs.existsSync(correctPath)) {
                return res.sendFile(correctPath);
              }
            }

            // If we get here, create a placeholder image
            createColoredPlaceholder(fullPath, res);
          })
          .catch((err) => {
            console.error(`Error querying database: ${err.message}`);
            createColoredPlaceholder(fullPath, res);
          });
      } else {
        // If no database access, create placeholder
        createColoredPlaceholder(fullPath, res);
      }
    } catch (error) {
      console.error(`Error checking database: ${error.message}`);
      createColoredPlaceholder(fullPath, res);
    }
  } else {
    // For other file patterns, create a placeholder
    createColoredPlaceholder(fullPath, res);
  }
});

// Also handle the lowercase version of the path with improved error handling
app.use("/api/images/:filename", (req, res, next) => {
  const requestedFilename = req.params.filename;
  const fullPath = path.join(imagesPath, requestedFilename);

  // If create parameter is present, always create the image
  if (req.query.create === "true") {
    return createColoredPlaceholder(fullPath, res);
  }

  // Check if file exists
  if (fs.existsSync(fullPath)) {
    // File exists, serve it directly
    return res.sendFile(fullPath);
  }

  console.log(
    `Requested image not found (lowercase path): ${requestedFilename}, creating placeholder`,
  );

  // If file doesn't exist, create a placeholder image
  createColoredPlaceholder(fullPath, res);
});

// Image serving middleware - comes AFTER the custom handlers
app.use(
  "/API/images",
  (req, res, next) => {
    const fullPath = path.join(imagesPath, req.path);
    let fileExists = false;

    try {
      fileExists = fs.existsSync(fullPath);
    } catch (err) {
      // Silently handle error
    }

    if (!fileExists) {
      return res.status(404).send("Image not found");
    }
    next();
  },
  express.static(imagesPath),
);

// Also serve images from lowercase path for compatibility
app.use("/api/images", express.static(imagesPath));

// Consolidated save-images endpoint
app.post("/api/save-images", async (req, res) => {
  console.log("Received save-images request");
  try {
    // First try the original function
    let result;
    if (typeof checkAndSaveImages === "function") {
      try {
        result = await checkAndSaveImages();
        console.log("Original image save result:", result);
      } catch (originalErr) {
        console.error("Error in original image save function:", originalErr);
      }
    }

    // Then ensure images directory exists
    if (!fs.existsSync(imagesPath)) {
      try {
        fs.mkdirSync(imagesPath, { recursive: true });
        console.log(`Created images directory at: ${imagesPath}`);
      } catch (dirErr) {
        console.error(`Error creating images directory: ${dirErr.message}`);
      }
    }

    // Check for specific expected images and create if missing
    const expectedImages = [
      "A03Muraminalol.png",
      "test.png",
      "A03minabananas.png",
      "A03marikoepVT.png",
      "A03nenmie_.png",
      "A03plzwork.png",
      "A03rainmeww.png",
      "A03ropumimi.png",
      "A03s4kivt.png",
      "A03softvoicena.png",
      "A03yuumemiruu.png",
      "A03ywunmin.png",
      "A03ywuria.png",
    ];

    for (const imageName of expectedImages) {
      const imagePath = path.join(imagesPath, imageName);

      if (!fs.existsSync(imagePath)) {
        console.log(`Creating missing image: ${imageName}`);
        createColoredPlaceholder(imagePath);
      }
    }

    // Then ensure all images are in the right place
    const filesCopied = ensureImagesAreAvailable();

    // List all files in the images directory
    const existingFiles = fs.existsSync(imagesPath)
      ? fs.readdirSync(imagesPath)
      : [];

    res.status(200).send({
      success: true,
      message: "Images refreshed",
      originalResult: result,
      imagesPath,
      filesCopied,
      files: existingFiles,
    });
  } catch (error) {
    console.error("Error during image refresh:", error);
    res.status(500).send({
      error: "Failed to refresh images",
      message: error.message,
    });
  }
});

// Enhanced fetch-emails endpoint
app.get("/fetch-emails", async (req, res) => {
  console.log("Received fetch-emails request");
  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Email fetch timeout after 30 seconds")),
        30000,
      ),
    );

    // Add specific debugging information
    console.log("Attempting to fetch emails...");

    // Create a more detailed response
    let result;
    try {
      result = await Promise.race([startFetchingEmails(), timeoutPromise]);
      console.log("Email fetch result:", result);

      // Add more details to the response
      if (result.success) {
        if (!result.count || result.count === 0) {
          // No emails were processed, check if we received any unread emails
          console.log(
            "No emails were processed. Checking for any unread messages...",
          );

          // Add additional information to the response
          result.message = result.message || "No new emails were processed";
          result.suggestions = [
            "Check if there are any unread emails in the Gmail inbox",
            "Verify that emails have the subject '- DO NOT OPEN -'",
            "Ensure Gmail API access is properly configured",
          ];
        } else {
          console.log(`Successfully processed ${result.count} emails`);
        }
      } else {
        console.error("Email fetch failed:", result.error);
      }
    } catch (fetchError) {
      console.error("Error during email fetch:", fetchError);
      result = {
        success: false,
        error: fetchError.message,
        stack: fetchError.stack,
      };
    }

    // Enhance the response with server information
    const enhancedResponse = {
      ...result,
      serverTime: new Date().toISOString(),
      endpoints: {
        imagesPath: imagesPath,
        imageDebug: "http://localhost:5000/api/debug-image-paths",
        imageList: "http://localhost:5000/api/list-images",
        diagnostic: "http://localhost:5000/diagnostic",
      },
    };

    res.send(enhancedResponse);
  } catch (error) {
    console.error("Error handling fetch-emails request:", error);
    res.status(500).json({
      error: "Failed to fetch emails",
      message: error.message,
      stack: error.stack,
      serverTime: new Date().toISOString(),
    });
  }
});

// Gmail Authentication Test endpoint
app.get("/api/test-gmail-auth", async (req, res) => {
  try {
    console.log("Testing Gmail authentication...");

    // Try to read and parse the token file
    const tokenPath = getTokenPath();
    let tokenData = null;

    if (!tokenPath) {
      return res.json({
        success: false,
        error: "Token file not found",
        needsReauth: true,
      });
    }

    try {
      const tokenContent = await fs.promises.readFile(tokenPath, "utf8");
      tokenData = JSON.parse(tokenContent);
      console.log("Token data read successfully");
    } catch (tokenErr) {
      console.error("Error reading token:", tokenErr);
      return res.json({
        success: false,
        error: `Error reading token file: ${tokenErr.message}`,
        needsReauth: true,
      });
    }

    // Try to initialize OAuth client
    try {
      const credsPath = getCredentialsPath();
      if (!credsPath) {
        return res.json({
          success: false,
          error: "Credentials file not found",
          needsReauth: true,
        });
      }

      const credsContent = await fs.promises.readFile(credsPath, "utf8");
      const credentials = JSON.parse(credsContent);
      const { client_id, client_secret, redirect_uris } =
        credentials.installed || credentials.web;

      const oauth2Client = new google.auth.OAuth2(
        client_id,
        client_secret,
        redirect_uris[0],
      );

      if (tokenData) {
        oauth2Client.setCredentials(tokenData);

        // Try a test request
        try {
          const gmail = google.gmail({ version: "v1", auth: oauth2Client });
          const profile = await gmail.users.getProfile({ userId: "me" });
          console.log("Successful API test with profile data");

          return res.json({
            success: true,
            email: profile.data.emailAddress,
            tokenInfo: {
              hasAccessToken: !!tokenData.access_token,
              hasRefreshToken: !!tokenData.refresh_token,
              tokenType: tokenData.token_type,
              expiryDate: tokenData.expiry_date
                ? new Date(tokenData.expiry_date).toISOString()
                : "unknown",
            },
          });
        } catch (apiErr) {
          console.error("API test failed:", apiErr);
          return res.json({
            success: false,
            error: apiErr.message,
            tokenInfo: {
              hasAccessToken: !!tokenData.access_token,
              hasRefreshToken: !!tokenData.refresh_token,
              tokenType: tokenData.token_type,
              expiryDate: tokenData.expiry_date
                ? new Date(tokenData.expiry_date).toISOString()
                : "unknown",
            },
            needsReauth: apiErr.code === 401 || apiErr.status === 401,
          });
        }
      } else {
        return res.json({
          success: false,
          error: "No token data available",
          needsReauth: true,
        });
      }
    } catch (clientErr) {
      console.error("Error creating OAuth client:", clientErr);
      return res.json({
        success: false,
        error: "Error creating OAuth client: " + clientErr.message,
        needsReauth: true,
      });
    }
  } catch (err) {
    console.error("Error in auth test endpoint:", err);
    return res.status(500).json({
      success: false,
      error: err.message,
      needsReauth: true,
    });
  }
});

// Gmail Reauthorization endpoint
app.get("/api/reauthorize", async (req, res) => {
  try {
    console.log("Starting Gmail reauthorization process...");

    // Create a new OAuth client
    const credsPath = getCredentialsPath();
    if (!credsPath) {
      return res.status(500).json({
        success: false,
        error: "Credentials file not found",
      });
    }

    const credsContent = await fs.promises.readFile(credsPath, "utf8");
    const credentials = JSON.parse(credsContent);

    if (!credentials.installed && !credentials.web) {
      return res.status(500).json({
        success: false,
        error: "Invalid credentials format in credentials.json",
      });
    }

    const { client_id, client_secret, redirect_uris } =
      credentials.installed || credentials.web;

    if (
      !client_id ||
      !client_secret ||
      !redirect_uris ||
      redirect_uris.length === 0
    ) {
      return res.status(500).json({
        success: false,
        error: "Missing required OAuth client information in credentials",
      });
    }

    const oauth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris[0],
    );

    // Generate an authentication URL
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: ["https://www.googleapis.com/auth/gmail.modify"],
      prompt: "consent", // Force to get a new refresh token
    });

    console.log("Generated auth URL for Gmail reauthorization");

    res.json({
      success: true,
      authUrl,
      message:
        "Please open this URL in your browser to authorize access to Gmail",
    });
  } catch (error) {
    console.error("Error generating auth URL:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate authorization URL: " + error.message,
    });
  }
});

// OAuth callback handler
app.get("/oauth2callback", async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send("Authorization code is missing");
  }

  try {
    const credsPath = getCredentialsPath();
    const credsContent = await fs.promises.readFile(credsPath, "utf8");
    const credentials = JSON.parse(credsContent);
    const { client_id, client_secret, redirect_uris } =
      credentials.installed || credentials.web;

    const oauth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris[0],
    );

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    // Save tokens
    const tokenPath = getTokenPath();
    await fs.promises.writeFile(tokenPath, JSON.stringify(tokens));

    res.send(`
      <html>
        <body>
          <h1>Authorization Successful</h1>
          <p>Your Gmail authorization has been completed successfully.</p>
          <p>You can close this window and return to the application.</p>
          <script>
            // Close window after 5 seconds
            setTimeout(() => window.close(), 5000);
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("Error handling OAuth callback:", error);
    res.status(500).send(`
      <html>
        <body>
          <h1>Authorization Failed</h1>
          <p>There was an error completing the authorization process:</p>
          <pre>${error.message}</pre>
          <p>Please close this window and try again.</p>
        </body>
      </html>
    `);
  }
});

// Server test endpoint
app.get("/test", (req, res) => {
  res.send("Server is running properly");
});

// Test image access endpoint
app.get("/test-image-access", (req, res) => {
  res.send(`
    <html>
      <head><title>Image Test</title></head>
      <body>
        <h1>Image Access Test</h1>
        <p>Testing image access from: ${imagesPath}</p>
        <div>
          <h3>Test Image</h3>
          <img src="/API/images/test.png?t=${Date.now()}" alt="Test Image" 
               onerror="this.onerror=null; this.src='/api/images/test.png?t=${Date.now()}'; this.alt='Trying lowercase path';" />
        </div>
        <div>
          <h3>A03Muraminalol.png</h3>
          <img src="/API/images/A03Muraminalol.png?t=${Date.now()}" alt="A03Muraminalol.png" 
               onerror="this.onerror=null; this.src='/api/images/A03Muraminalol.png?t=${Date.now()}'; this.alt='Trying lowercase path';" />
        </div>
        <div>
          <h3>Available Image Files</h3>
          <pre>${
            fs.existsSync(imagesPath)
              ? JSON.stringify(fs.readdirSync(imagesPath), null, 2)
              : "Images directory not found"
          }</pre>
        </div>
      </body>
    </html>
  `);
});

// List images endpoint
app.get("/api/list-images", (req, res) => {
  try {
    if (fs.existsSync(imagesPath)) {
      const files = fs.readdirSync(imagesPath);
      res.json({
        imagesPath,
        fileCount: files.length,
        files,
      });
    } else {
      res.status(404).json({
        error: "Images directory not found",
        imagesPath,
      });
    }
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

// Add these routes to your server.js file

// Gmail Authentication Test endpoint
app.get("/api/test-gmail-auth", (req, res) => {
  // Simple version that just returns a success message
  res.json({
    success: false,
    error: "Gmail authentication needs to be reconfigured",
    needsReauth: true,
  });
});

// Simple endpoint to handle creating placeholder images
app.get("/API/images/:filename", (req, res) => {
  const requestedFilename = req.params.filename;
  const fullPath = path.join(imagesPath, requestedFilename);

  // If the file exists, serve it
  if (fs.existsSync(fullPath)) {
    return res.sendFile(fullPath);
  }

  // If create parameter is present, create a placeholder
  if (req.query.create === "true") {
    try {
      // Make sure directory exists
      if (!fs.existsSync(imagesPath)) {
        fs.mkdirSync(imagesPath, { recursive: true });
      }

      // Create a colored placeholder (simple blue square)
      const placeholderData = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAnElEQVR42u3RAQ0AAAQAMCHa27Ay/GYMPJKqKyvvAAAAAAAAAAAAAAAAAAAAAAAAAAAAxCHqxseQIS0NaRoSGRIZ0tKQpiGRIZEhLQ1pGhIZEhnS0pCmIZEhkSEtDWkaEhkSGdLSkKYhkSGRIS0NaRoSGRIZ0tKQpiGRIZEhLQ1pGhIZEhnS0pCmIZEhkSEtDWkaEhkSGdLSkKYh+WzID/fgBFrDYFnyAAAAAElFTkSuQmCC",
        "base64",
      );

      fs.writeFileSync(fullPath, placeholderData);
      console.log(`Created placeholder image at: ${fullPath}`);

      // Serve the newly created placeholder
      return res.sendFile(fullPath);
    } catch (error) {
      console.error(`Error creating placeholder: ${error.message}`);
      return res
        .status(404)
        .send("Image not found and could not create placeholder");
    }
  }

  // For regular requests without create parameter
  return res.status(404).send("Image not found");
});

// Gmail Reauthorization endpoint - direct version
app.get("/api/reauthorize-direct", (req, res) => {
  try {
    // Try to find credentials.json
    const credsPath = findCredentialPath("credentials.json");

    if (!credsPath) {
      return res
        .status(500)
        .send(
          "<h1>Credentials file not found</h1><p>Make sure credentials.json exists in the API directory.</p>",
        );
    }

    // Load credentials
    const credentials = JSON.parse(fs.readFileSync(credsPath, "utf8"));
    const { client_id, client_secret, redirect_uris } =
      credentials.installed || credentials.web;

    // Create OAuth client
    const oauth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris[0],
    );

    // Generate auth URL
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: ["https://www.googleapis.com/auth/gmail.modify"],
      prompt: "consent", // Force to get a new refresh token
    });

    // Redirect to auth URL
    res.redirect(authUrl);
  } catch (error) {
    res
      .status(500)
      .send(
        `<h1>Error</h1><p>Failed to start reauthorization: ${error.message}</p>`,
      );
  }
});

// Add this code to your server.js file

// Helper function to find credential files (if you don't already have it)
function findCredentialPath(filename) {
  const possiblePaths = [
    path.join(__dirname, filename),
    path.join(process.cwd(), "src/API", filename),
    path.join(process.resourcesPath || "", "src/API", filename),
  ];

  for (const testPath of possiblePaths) {
    try {
      if (fs.existsSync(testPath)) {
        return testPath;
      }
    } catch (err) {
      // Skip inaccessible paths
    }
  }

  return null;
}

app.get("/api/reauthorize-direct", async (req, res) => {
  try {
    console.log("Starting direct Gmail reauthorization process...");

    // Create a new OAuth client
    const credsPath = getCredentialsPath();
    if (!credsPath) {
      return res.status(500).send("Credentials file not found");
    }

    const credsContent = await fs.promises.readFile(credsPath, "utf8");
    const credentials = JSON.parse(credsContent);

    if (!credentials.installed && !credentials.web) {
      return res
        .status(500)
        .send("Invalid credentials format in credentials.json");
    }

    const { client_id, client_secret, redirect_uris } =
      credentials.installed || credentials.web;

    if (
      !client_id ||
      !client_secret ||
      !redirect_uris ||
      redirect_uris.length === 0
    ) {
      return res
        .status(500)
        .send("Missing required OAuth client information in credentials");
    }

    const oauth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris[0],
    );

    // Generate an authentication URL
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: ["https://www.googleapis.com/auth/gmail.modify"],
      prompt: "consent", // Force to get a new refresh token
    });

    console.log("Generated auth URL for Gmail reauthorization");

    // Redirect directly to the auth URL
    res.redirect(authUrl);
  } catch (error) {
    console.error("Error generating auth URL:", error);
    res
      .status(500)
      .send("Failed to generate authorization URL: " + error.message);
  }
});

// Diagnostic endpoint
app.get("/diagnostic", (req, res) => {
  const info = {
    serverTime: new Date().toISOString(),
    currentDirectory: __dirname,
    workingDirectory: process.cwd(),
    imagesPath: imagesPath,
    imagesExist: fs.existsSync(imagesPath),
    tokenPath: getTokenPath(),
    credentialsPath: getCredentialsPath(),
  };

  if (info.imagesExist) {
    try {
      const files = fs.readdirSync(imagesPath);
      info.imageCount = files.length;
      info.imageExamples = files.slice(0, 5);
    } catch (err) {
      info.imageError = err.message;
    }
  }

  // Check token status
  try {
    const tokenPath = getTokenPath();
    if (tokenPath && fs.existsSync(tokenPath)) {
      const tokenData = JSON.parse(fs.readFileSync(tokenPath, "utf8"));
      info.tokenStatus = {
        exists: true,
        hasAccessToken: !!tokenData.access_token,
        hasRefreshToken: !!tokenData.refresh_token,
        expiryDate: tokenData.expiry_date
          ? new Date(tokenData.expiry_date).toISOString()
          : "unknown",
      };
    } else {
      info.tokenStatus = {
        exists: false,
      };
    }
  } catch (err) {
    info.tokenStatus = {
      exists: false,
      error: err.message,
    };
  }

  res.json(info);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({
    error: "Something broke on the server",
    message: err.message,
  });
});

// Handle uncaught errors
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

// Start the server
let serverInstance;
try {
  serverInstance = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`Test image at: http://localhost:${port}/API/images/test.png`);
    console.log(
      `Test image access page: http://localhost:${port}/test-image-access`,
    );
    console.log(`Diagnostic endpoint: http://localhost:${port}/diagnostic`);
  });

  serverInstance.on("error", (error) => {
    console.error(`Server error: ${error.message}`);
    if (error.code === "EADDRINUSE") {
      console.error(`Port ${port} is already in use. Trying next port.`);
      serverInstance = app.listen(port + 1, () => {
        const newPort = port + 1;
        console.log(`Server now running on port ${newPort}`);
      });
    }
  });
} catch (err) {
  console.error(`Failed to start server: ${err.message}`);
}

// Handle graceful shutdown
function shutDown() {
  console.log("Received kill signal, shutting down gracefully");
  if (serverInstance) {
    serverInstance.close(() => {
      console.log("Closed out remaining connections");
      process.exit(0);
    });

    // Force close after 10s
    setTimeout(() => {
      console.error(
        "Could not close connections in time, forcefully shutting down",
      );
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
}

process.on("SIGTERM", shutDown);
process.on("SIGINT", shutDown);

module.exports = app;
