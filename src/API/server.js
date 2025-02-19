const express = require("express");
const { startFetchingEmails } = require("./script");
const checkAndSaveImages = require("./imageSave");
const path = require("path");
const cors = require("cors");

const app = express();
const port = 5000;

// Middleware
app.use(cors());
app.use("/API/images", express.static(path.join(__dirname, "images")));

app.post("/api/save-images", async (req, res) => {
  try {
    await checkAndSaveImages();
    res.status(200).send("Images refreshed successfully");
  } catch (error) {
    console.error("Error during image refresh:", error);
    res.status(500).send("Failed to refresh images");
  }
});

app.get("/fetch-emails", async (req, res) => {
  try {
    await startFetchingEmails();
    res.send("Emails fetched successfully");
  } catch (error) {
    console.error("Error fetching emails: ", error);
    res.status(500).send("Failed to fetch");
  }
});

// Start the server
const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Handle shutdown gracefully
const shutdown = () => {
  console.log("Received shutdown signal, closing server gracefully...");
  server.close((err) => {
    if (err) {
      console.error("Error closing server:", err);
      process.exit(1);
    }
    console.log("Server closed successfully");
    process.exit(0);
  });
};

// Listen for termination signals
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
