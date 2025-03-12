const fs = require("fs");
const path = require("path");
const { app } = require("electron");

/**
 * Find a writable images directory with robust fallbacks
 * @returns {string} Path to images directory
 */
function findImagesDirectory() {
  console.log("Finding images directory...");

  // Try these locations in order of preference
  const possibleDirs = [
    // User data directory (most reliable for write access)
    path.join(app.getPath("userData"), "images"),
    // Other possible locations
    path.join(process.resourcesPath || "", "src/API/images"),
    path.join(app.getAppPath(), "src/API/images"),
    path.join(process.cwd(), "images"),
  ];

  // Log all potential directories we're checking
  console.log("Possible image directories:", possibleDirs);

  // Find the first writable directory
  for (const dir of possibleDirs) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
      }

      // Test if the directory is writable
      const testFile = path.join(dir, ".write-test");
      fs.writeFileSync(testFile, "test");
      fs.unlinkSync(testFile);

      console.log(`Using writable directory: ${dir}`);
      return dir;
    } catch (err) {
      console.log(`Directory ${dir} is not writable: ${err.message}`);
    }
  }

  // If all else fails, try to use the temp directory
  try {
    const tempDir = path.join(app.getPath("temp"), "commission-images");
    fs.mkdirSync(tempDir, { recursive: true });
    console.log(`Falling back to temp directory: ${tempDir}`);
    return tempDir;
  } catch (err) {
    console.error(`Failed to create temp directory: ${err.message}`);
  }

  throw new Error("Could not find or create a writable directory for images");
}

/**
 * Create a placeholder image at the specified path
 * @param {string} imagePath - Path where the placeholder should be saved
 * @returns {boolean} - Success status
 */
function createPlaceholderImage(imagePath) {
  try {
    console.log(`Creating placeholder image at: ${imagePath}`);

    // Make sure the directory exists
    const dir = path.dirname(imagePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // This is a simple blue square placeholder (50x50)
    const placeholderData = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAAABmJLR0QA/wD/AP+gvaeTAAAAnElEQVRoge3RAQ0AAAQAMCHa27Ay/GYMPJKqKyvvAAAAAAAAAAAAAAAAAAAAAAAAAAAAxCHqxseQIS0NaRoSGRIZ0tKQpiGRIZEhLQ1pGhIZEhnS0pCmIZEhkSEtDWkaEhkSGdLSkKYhkSGRIS0NaRoSGRIZ0tKQpiGRIZEhLQ1pGhIZEhnS0pCmIZEhkSEtDWkaEhkSGdLSkKYh+WzID/fgBFrDYFnyAAAAAElFTkSuQmCC",
      "base64",
    );

    fs.writeFileSync(imagePath, placeholderData);
    console.log(`Created placeholder image at: ${imagePath}`);
    return true;
  } catch (error) {
    console.error(`Error creating placeholder: ${error.message}`);
    return false;
  }
}

/**
 * Download an attachment from Gmail with improved error handling and retries
 * @param {Object} gmailClient - Gmail API client
 * @param {string} messageId - Gmail message ID
 * @param {string} attachmentId - Attachment ID
 * @param {string} docId - Document ID for the image filename
 * @returns {Promise<string|null>} Path to the saved image or null on failure
 */
async function downloadAttachment(gmailClient, messageId, attachmentId, docId) {
  if (!gmailClient) {
    console.error("Gmail client not initialized");
    return null;
  }

  const maxRetries = 3;
  let retryCount = 0;
  let lastError = null;

  while (retryCount < maxRetries) {
    try {
      console.log(
        `Downloading attachment for ${docId} (attempt ${retryCount + 1}/${maxRetries})`,
      );

      // Find a writable directory
      const imagesDir = findImagesDirectory();
      const imagePath = path.join(imagesDir, `${docId}.png`);

      // Skip if file already exists and is not a placeholder
      if (fs.existsSync(imagePath)) {
        const stats = fs.statSync(imagePath);
        if (stats.size > 2000) {
          console.log(
            `Image for ${docId} already exists and is not a placeholder, skipping download`,
          );
          return imagePath;
        }
      }

      // Fetch attachment data with timeout
      console.log(
        `Fetching attachment data for ${messageId}, attachment ${attachmentId}`,
      );
      const attachmentData = await Promise.race([
        gmailClient.users.messages.attachments.get({
          userId: "me",
          messageId: messageId,
          id: attachmentId,
        }),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Attachment download timed out after 30s")),
            30000,
          ),
        ),
      ]);

      if (!attachmentData.data || !attachmentData.data.data) {
        throw new Error("No data in attachment response");
      }

      // Decode the Base64 string with proper character replacement
      const base64Data = attachmentData.data.data
        .replace(/-/g, "+")
        .replace(/_/g, "/");

      // Convert to binary buffer
      const imageBuffer = Buffer.from(base64Data, "base64");
      console.log(`Downloaded image data, size: ${imageBuffer.length} bytes`);

      if (imageBuffer.length < 1000) {
        throw new Error("Downloaded image is too small, likely invalid");
      }

      // Save the image
      fs.writeFileSync(imagePath, imageBuffer);
      console.log(`Image saved at: ${imagePath}`);

      return imagePath;
    } catch (error) {
      lastError = error;
      console.error(
        `Error downloading attachment (attempt ${retryCount + 1}): ${error.message}`,
      );
      retryCount++;

      // Wait before retrying (exponential backoff)
      if (retryCount < maxRetries) {
        const delay = 1000 * Math.pow(2, retryCount);
        console.log(`Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  console.error(
    `Failed to download attachment after ${maxRetries} attempts: ${lastError?.message}`,
  );
  return null;
}

/**
 * Fix a specific image by re-downloading it from Gmail
 * @param {Object} gmailClient - Gmail API client
 * @param {Object} db - Firestore database reference
 * @param {string} imageName - Name of the image file (e.g., "A03username.png")
 * @returns {Promise<Object>} Result of the fix operation
 */
async function fixSpecificImage(gmailClient, db, imageName) {
  try {
    console.log(`Attempting to fix specific image: ${imageName}`);

    // Extract docId from image name (remove extension)
    const docId = imageName.replace(/\.png$/i, "");

    // Find a writable directory
    const imagesDir = findImagesDirectory();
    const imagePath = path.join(imagesDir, imageName);

    // Check if we have database access
    if (!db) {
      // If no DB access, just create a placeholder
      createPlaceholderImage(imagePath);
      return {
        success: false,
        error: "Firebase database not initialized",
        path: imagePath,
        isPlaceholder: true,
      };
    }

    // Try to find the document in Firebase
    console.log(`Looking up document ID: ${docId}`);
    const doc = await db.collection("commissions").doc(docId).get();

    if (!doc.exists) {
      // Document not found, create placeholder
      createPlaceholderImage(imagePath);
      return {
        success: false,
        error: `Document ${docId} not found in database`,
        path: imagePath,
        isPlaceholder: true,
      };
    }

    // Get the necessary data
    const data = doc.data();
    const messageId = data.MSG_ID;
    const attachmentId = data.IMG1;

    if (!messageId || !attachmentId) {
      // Missing required data, create placeholder
      createPlaceholderImage(imagePath);
      return {
        success: false,
        error: "Missing message ID or attachment ID in document",
        path: imagePath,
        isPlaceholder: true,
      };
    }

    // Check if Gmail is initialized
    if (!gmailClient) {
      // No Gmail client, create placeholder
      createPlaceholderImage(imagePath);
      return {
        success: false,
        error: "Gmail client not initialized",
        path: imagePath,
        isPlaceholder: true,
      };
    }

    // Try downloading the image
    const savedPath = await downloadAttachment(
      gmailClient,
      messageId,
      attachmentId,
      docId,
    );

    if (!savedPath) {
      // Download failed, create placeholder
      createPlaceholderImage(imagePath);
      return {
        success: false,
        error: "Failed to download image",
        path: imagePath,
        isPlaceholder: true,
      };
    }

    return {
      success: true,
      message: `Successfully fixed image ${imageName}`,
      path: savedPath,
      isPlaceholder: false,
    };
  } catch (error) {
    console.error(`Error fixing image ${imageName}:`, error);
    return {
      success: false,
      error: error.message,
      isPlaceholder: false,
    };
  }
}

/**
 * Reprocess all critical images
 * @param {Object} gmailClient - Gmail API client
 * @param {Object} db - Firestore database reference
 * @returns {Promise<Object>} Result of the reprocessing
 */
async function reprocessAllImages(gmailClient, db) {
  console.log("Starting to reprocess all images...");

  try {
    // Find a writable directory
    const imagesDir = findImagesDirectory();

    // Critical images that should always be available
    const criticalImages = [
      "test.png",
      "A03Muraminalol.png",
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

    // Results tracking
    const results = {
      placeholdersCreated: 0,
      imagesDownloaded: 0,
      failures: 0,
      details: [],
    };

    // Ensure all critical images exist as placeholders
    for (const imageName of criticalImages) {
      const imagePath = path.join(imagesDir, imageName);

      // Check if image exists and is not a placeholder
      let needsReplacement = !fs.existsSync(imagePath);

      if (!needsReplacement) {
        // Check if file is very small (likely a placeholder)
        try {
          const stats = fs.statSync(imagePath);
          if (stats.size < 2000) {
            needsReplacement = true;
          }
        } catch (err) {
          needsReplacement = true;
        }
      }

      if (needsReplacement) {
        // If we have DB and Gmail access, try to download the actual image
        if (db && gmailClient) {
          try {
            // Extract document ID from filename
            const docId = imageName.replace(/\.png$/i, "");

            // Look up the document
            const doc = await db.collection("commissions").doc(docId).get();

            if (doc.exists) {
              const data = doc.data();
              if (data.MSG_ID && data.IMG1) {
                // Try to download the image
                const savedPath = await downloadAttachment(
                  gmailClient,
                  data.MSG_ID,
                  data.IMG1,
                  docId,
                );

                if (savedPath) {
                  console.log(`Downloaded image for ${docId}`);
                  results.imagesDownloaded++;
                  results.details.push({
                    image: imageName,
                    action: "downloaded",
                    success: true,
                  });
                  continue;
                }
              }
            }
          } catch (err) {
            console.error(`Error downloading ${imageName}: ${err.message}`);
          }
        }

        // If download failed or wasn't attempted, create placeholder
        if (createPlaceholderImage(imagePath)) {
          results.placeholdersCreated++;
          results.details.push({
            image: imageName,
            action: "placeholder-created",
            success: true,
          });
        } else {
          results.failures++;
          results.details.push({
            image: imageName,
            action: "placeholder-creation-failed",
            success: false,
          });
        }
      } else {
        results.details.push({
          image: imageName,
          action: "already-exists",
          success: true,
        });
      }
    }

    // If we have Firestore access, try to download images for all commission documents
    if (db && gmailClient) {
      try {
        console.log("Checking Firestore for commission documents...");
        const snapshot = await db.collection("commissions").get();

        if (!snapshot.empty) {
          for (const doc of snapshot.docs) {
            const docId = doc.id;
            const data = doc.data();
            const messageId = data.MSG_ID;
            const attachmentId = data.IMG1;

            if (!messageId || !attachmentId) {
              continue;
            }

            const imagePath = path.join(imagesDir, `${docId}.png`);

            // Check if image needs to be downloaded
            let needsDownload = !fs.existsSync(imagePath);

            if (!needsDownload) {
              // Check if file is very small (likely a placeholder)
              try {
                const stats = fs.statSync(imagePath);
                if (stats.size < 2000) {
                  needsDownload = true;
                }
              } catch (err) {
                needsDownload = true;
              }
            }

            if (needsDownload) {
              try {
                console.log(`Downloading image for ${docId}...`);
                const savedPath = await downloadAttachment(
                  gmailClient,
                  messageId,
                  attachmentId,
                  docId,
                );

                if (savedPath) {
                  results.imagesDownloaded++;
                  results.details.push({
                    image: `${docId}.png`,
                    action: "downloaded",
                    success: true,
                  });
                } else {
                  // Create placeholder if download fails
                  if (createPlaceholderImage(imagePath)) {
                    results.placeholdersCreated++;
                    results.details.push({
                      image: `${docId}.png`,
                      action: "placeholder-created-after-download-failed",
                      success: true,
                    });
                  } else {
                    results.failures++;
                    results.details.push({
                      image: `${docId}.png`,
                      action: "all-attempts-failed",
                      success: false,
                    });
                  }
                }
              } catch (downloadErr) {
                console.error(
                  `Error downloading image for ${docId}: ${downloadErr.message}`,
                );
                results.failures++;
                results.details.push({
                  image: `${docId}.png`,
                  action: "download-failed",
                  success: false,
                  error: downloadErr.message,
                });
              }
            }
          }
        }
      } catch (dbErr) {
        console.error(`Error accessing Firebase: ${dbErr.message}`);
        results.details.push({
          action: "firebase-access-failed",
          success: false,
          error: dbErr.message,
        });
      }
    }

    return {
      success: true,
      message: `Reprocessed images: ${results.imagesDownloaded} downloaded, ${results.placeholdersCreated} placeholders created, ${results.failures} failures`,
      results,
    };
  } catch (error) {
    console.error("Error in reprocessAllImages:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

module.exports = {
  findImagesDirectory,
  createPlaceholderImage,
  downloadAttachment,
  fixSpecificImage,
  reprocessAllImages,
};
