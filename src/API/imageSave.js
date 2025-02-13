const express = require('express');
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const serviceAccount = require('./commissions-app-c6e2c-firebase-adminsdk-fbsvc-473cacb7d7.json');

const router = express.Router();

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://commissions-app-c6e2c.firebaseio.com'
});

const db = admin.firestore();

// Function to check and save images for all IDs
const checkAndSaveImages = async () => {
  try {
    const snapshot = await db.collection('commissions').get(); // Fetch all documents from 'commissions' collection
    if (snapshot.empty) {
      console.log('No documents found.');
      return;
    }

    // Loop through each document
    snapshot.forEach(async (doc) => {
      const ID = doc.id; // Get document ID
      const imageData = doc.data().IMG1; // Get image base64 data

      if (!imageData) {
        console.log(`No image data found for document ID: ${ID}`); // if for some reason we don't have IMG1 data
        return;
      }

      // Define image path
      const imagePath = path.join(__dirname, './images', `${ID}.png`); //  document ID as image filename (__dirname is just the path we in now)

      // Check if image exists in local imagePath
      if (fs.existsSync(imagePath)) { // existsSync just returns true or false if image exists
        console.log(`Img with ID ${ID} exists in your local ^.^7 -- image path: ${imagePath}`);
      } else {
        // Decode base64 string and save the image if not in local
        const imageBuffer = Buffer.from(imageData, 'base64'); // back to binary
        fs.writeFileSync(imagePath, imageBuffer); // Save image to ./images folder
        console.log(`Image with ID ${ID} saved at ${imagePath} ^^7`);
      }
    });
  } catch (error) {
    console.error('Error with script imageSave:', error);
  }
};

// Add an API route to trigger the image check and save process
router.get('/save-images', async (req, res) => {
  await checkAndSaveImages(); // Trigger the image saving process
  res.send('Images check and save DONE!');
});

module.exports = router;
