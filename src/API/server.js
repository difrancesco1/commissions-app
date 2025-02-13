const express = require("express");
const checkAndSaveImages = require("./imageSave");
const path = require("path"); // To handle file paths
const app = express();
const port = 5000; // Backend port
const cors = require("cors");

app.use(cors()); // Enable CORS for all routes because frontend and backend are on different ports

// Serve static images from the 'images/' folder inside the 'API' directory
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

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
