const express = require("express");
const checkAndSaveImages = require("./imageSave");
const app = express();
const port = 5000; //  backend port
const cors = require("cors");

app.use(cors()); // Enable CORS for all routes bc frontend and backend on diff ports

app.post("/api/save-images", async (req, res) => {
  try {
    await checkAndSaveImages();
    res.status(200).send("Images refreshed successfully");
  } catch (error) {
    console.error("Error during image refresh:", error);
    res.status(500).send("Failed to refresh images");
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
