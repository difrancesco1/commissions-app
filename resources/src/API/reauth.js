const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

// Set paths relative to current directory
const CREDENTIALS_PATH = path.join(__dirname, "credentials.json");
const TOKEN_PATH = path.join(__dirname, "token.json");

console.log(`Using credentials: ${CREDENTIALS_PATH}`);
console.log(`Token will be saved to: ${TOKEN_PATH}`);

async function authorize() {
  try {
    // Check if files exist
    if (!fs.existsSync(CREDENTIALS_PATH)) {
      console.error(`Credentials file not found at: ${CREDENTIALS_PATH}`);
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
    console.log("Authorize this app by visiting this URL:", authUrl);

    // Create a simple HTTP server to handle the redirect
    const http = require("http");
    const url = require("url");

    // Create server to listen for response
    const server = http.createServer(async (req, res) => {
      try {
        const queryParams = url.parse(req.url, true).query;

        if (queryParams.code) {
          // Close the server
          server.close();

          // Exchange code for tokens
          const { tokens } = await oAuth2Client.getToken(queryParams.code);
          oAuth2Client.setCredentials(tokens);

          // Save the token
          fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
          console.log("Token stored to:", TOKEN_PATH);

          // Return success message
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(`
            <h1>Authorization Successful</h1>
            <p>You have successfully authorized the application.</p>
            <p>You can close this window and return to the application.</p>
          `);

          // Exit process
          setTimeout(() => process.exit(0), 1000);
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
    server.listen(3000, () => {
      console.log("Listening for authorization callback on port 3000");
      console.log("Please open the authorization URL in your browser");
    });
  } catch (error) {
    console.error("Error during authorization:", error);
  }
}

// Run the authorization
authorize();
