const express = require('express');
const imageSave = require('./imageSave');

const app = express();

// Use your API route
app.use('./images', imageSave);

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
