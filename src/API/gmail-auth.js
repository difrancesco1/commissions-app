const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");
const http = require("http");
const url = require("url");

// Set paths relative to current directory
const CREDENTIALS_PATH = path.join(__dirname, "credentials.json");
const TOKEN_PATH = path.join(__dirname, "token.json");

console.log(`Using credentials: ${CREDENTIALS_PATH}`);
console.log(`Token will be saved to: ${TOKEN_PATH}`);

// Check if credentials exist
if (!fs.existsSync(CREDENTIALS_PATH)) {
  console.error(`Credentials file not found at: ${CREDENTIALS_PATH}`);
  console.log("Please place your credentials.json file in this directory.");
  process.exit(1);
}

// Read credentials
const content = fs.readFileSync(CREDENTIALS_PATH);
const credentials = JSON.parse(content);
const { client_id, client_secret, redirect_uris } =
  credentials.installed || credentials.web;

// Create OAuth2 client
const oAuth2Client = new google.auth.OAuth2(
  client_id,
  client_secret,
  redirect_uris[0],
);

// Generate the auth URL
const authUrl = oAuth2Client.generateAuthUrl({
  access_type: "offline",
  scope: ["https://www.googleapis.com/auth/gmail.modify"],
  prompt: "consent", // Force consent screen to get new refresh token
});

// Display the URL
console.log("\n==============================================");
console.log("Authorize this app by visiting this URL:");
console.log(authUrl);
console.log("==============================================\n");

// Create server to listen for response
const server = http.createServer(async (req, res) => {
  try {
    const queryParams = url.parse(req.url, true).query;

    if (queryParams.code) {
      console.log(
        `Received authorization code: ${queryParams.code.substring(0, 10)}...`,
      );

      // Exchange code for tokens
      console.log("Exchanging code for tokens...");
      const { tokens } = await oAuth2Client.getToken(queryParams.code);
      oAuth2Client.setCredentials(tokens);

      // Save the token
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
      console.log(`Token stored to: ${TOKEN_PATH}`);

      // Test the token
      console.log("Testing the token...");
      const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

      try {
        const profile = await gmail.users.getProfile({ userId: "me" });
        console.log(
          `Successfully authenticated as: ${profile.data.emailAddress}`,
        );

        // Return success message
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`
          <h1>Authorization Successful</h1>
          <p>You have successfully authorized the application as ${profile.data.emailAddress}.</p>
          <p>You can close this window and return to the application.</p>
        `);
      } catch (apiErr) {
        console.error("API test failed:", apiErr);

        res.writeHead(500, { "Content-Type": "text/html" });
        res.end(`
          <h1>API Test Failed</h1>
          <p>Authentication completed, but API test failed: ${apiErr.message}</p>
          <p>Token has been saved but may not work correctly.</p>
        `);
      }

      // Exit process after a short delay
      setTimeout(() => {
        console.log(
          "Authorization process complete. You can now restart your application.",
        );
        process.exit(0);
      }, 3000);
    } else {
      res.writeHead(400, { "Content-Type": "text/html" });
      res.end(
        "<h1>Authorization Failed</h1><p>No authorization code received.</p>",
      );
    }
  } catch (error) {
    console.error("Error handling callback:", error);
    res.writeHead(500, { "Content-Type": "text/html" });
    res.end(`<h1>Error</h1><p>${error.message}</p>`);
  }
});

// Listen on a free port
const PORT = 3000;
server.listen(PORT, () => {
  console.log(
    `\nListening for authorization callback on http://localhost:${PORT}`,
  );
  console.log("Please open the authorization URL in your browser");
  console.log(
    "After authorization, you will be redirected to a page confirming success.\n",
  );
});
