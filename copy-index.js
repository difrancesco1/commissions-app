const fs = require("fs");
const path = require("path");

const srcPath = path.join(__dirname, "src/main/index.js");
const destPath = path.join(__dirname, "out/main/index.js");

fs.copyFile(srcPath, destPath, (err) => {
  if (err) {
    console.error(`Error copying index.js: ${err}`);
  } else {
    console.log("index.js copied successfully!");
  }
});
