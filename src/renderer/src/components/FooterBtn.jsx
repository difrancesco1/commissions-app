import React, { useState, useEffect } from "react";
import styles from "./footerBtn.module.css";
import refreshgmail from "../../../assets/refreshgmail.png";
import copytocarrd from "../../../assets/copytocarrd.png";
import loading from "../../../assets/loading.gif";
import done from "../../../assets/done.png";
import imagefailed from "../../../assets/imagefailed.png";
import emailfailed from "../../../assets/emailfailed.png";
import allfailed from "../../../assets/exit.png";
import dog from "../../../assets/dog.gif";
const { ipcRenderer } = window.require("electron");

const FooterBtn = ({ setSearchQuery }) => {
  const [query, setQuery] = useState(""); // Local state for the search query
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshResult, setLastRefreshResult] = useState(null);
  const [isAuthorizing, setIsAuthorizing] = useState(false);

  // Handle input change and update the parent component
  const handleChange = (e) => {
    setQuery(e.target.value); // Update local state
    setSearchQuery(e.target.value); // Pass the query to the parent component
  };

  // Helper to get a detailed result message
  const getResultMessage = (emailResponse, imageResponse) => {
    // Return the standard placeholder to maintain visual consistency
    return "-.⊹˖ᯓ★. ݁₊";
  };

  // Function to check if images were loaded correctly
  const checkImagesLoaded = async () => {
    try {
      // Check a few known images to see if they load
      const imageNames = ["A03Muraminalol.png"]; // Add more if needed

      const testPromises = imageNames.map((name) => {
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ name, loaded: true });
          img.onerror = () => resolve({ name, loaded: false });
          img.src = `http://localhost:5000/API/images/${name}?t=${Date.now()}`; // Add cache buster
        });
      });

      const results = await Promise.all(testPromises);
      return results;
    } catch (error) {
      console.error("Error checking images:", error);
      return [];
    }
  };

  // Improved image debugging
  const debugImagePaths = async () => {
    try {
      const response = await fetch(
        "http://localhost:5000/api/debug-image-paths",
      );
      if (response.ok) {
        const data = await response.json();
        console.log("Image path debug info:", data);
        return data;
      }
    } catch (error) {
      console.error("Error getting image path debug info:", error);
    }
    return null;
  };

  // Function to create placeholder images for missing images
  const createPlaceholderImages = async () => {
    try {
      // List of expected images that should be available
      const expectedImages = [
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

      // Create placeholders for all missing images
      const createPromises = expectedImages.map(async (imageName) => {
        try {
          const response = await fetch(
            `http://localhost:5000/API/images/${imageName}?create=true`,
            { method: "GET" },
          );
          return { name: imageName, success: response.ok };
        } catch (err) {
          console.log(
            `Failed to create placeholder for ${imageName}: ${err.message}`,
          );
          return { name: imageName, success: false, error: err.message };
        }
      });

      const results = await Promise.all(createPromises);
      console.log("Placeholder creation results:", results);
      return results;
    } catch (error) {
      console.error("Error creating placeholder images:", error);
      return [];
    }
  };

  // Function to test Gmail authentication
  const testGmailAuth = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/test-gmail-auth");
      if (response.ok) {
        const data = await response.json();
        console.log("Gmail auth test result:", data);
        return data;
      }
    } catch (error) {
      console.error("Error testing Gmail auth:", error);
    }
    return null;
  };

  // Replace the handleReauthorizeClick function with this version
  const handleReauthorizeClick = async () => {
    if (isAuthorizing) return; // Prevent multiple clicks

    try {
      setIsAuthorizing(true);

      // Open a direct URL to the reauthorization page instead of using fetch
      const authWindow = window.open(
        "http://localhost:5000/api/reauthorize-direct",
        "_blank",
      );

      // Check if it opened successfully
      if (!authWindow) {
        alert("Please allow popups for this site to complete authorization");
      } else {
        // Show instruction to the user
        alert(
          "Please complete the authorization in the opened browser window. After authorization, come back to this application.",
        );
      }
    } catch (error) {
      console.error("Error starting reauthorization:", error);
      alert("Failed to start reauthorization process: " + error.message);
    } finally {
      setIsAuthorizing(false);
    }
  };

  // NEW FUNCTION: Handle reprocessing of images
  const handleReprocessImages = async (e) => {
    if (e) e.preventDefault(); // Prevent default right-click menu
    if (isRefreshing) return; // Prevent multiple clicks

    try {
      setIsRefreshing(true);
      var btn = document.getElementById("refreshBtn");
      var searchBar = document.getElementById("refreshresult");
      document.body.style.cursor = "wait";
      btn.src = loading;

      // Store the original placeholder
      const originalPlaceholder = searchBar.placeholder;
      searchBar.placeholder = "Reprocessing images...";

      console.log("🟡 Starting reprocessing...");

      // Call the reprocess-all endpoint
      const response = await fetch("http://localhost:5000/api/reprocess-all");

      if (response.ok) {
        const data = await response.json();
        console.log("🔵 Reprocess Response:", data);

        if (data.success) {
          console.log("Successfully reprocessed database entries");
          btn.src = done;
          searchBar.placeholder = `Reprocessed ${data.result?.successCount || 0} images`;
        } else {
          console.error("Failed to reprocess:", data.error);
          btn.src = imagefailed;
          searchBar.placeholder = "Failed to reprocess images";
        }
      } else {
        console.error("Error response:", response.status);
        btn.src = imagefailed;
        searchBar.placeholder = `Error: ${response.status}`;
      }

      // Check if images are now properly loading
      const imageCheckResults = await checkImagesLoaded();
      console.log("Image check results:", imageCheckResults);

      // Reset state after a delay
      setTimeout(() => {
        document.body.style.cursor = "default";
        setIsRefreshing(false);

        // Restore original placeholder after 5 seconds
        setTimeout(() => {
          searchBar.placeholder = originalPlaceholder;
        }, 5000);
      }, 1000);
    } catch (error) {
      console.error("Error reprocessing images:", error);
      var btn = document.getElementById("refreshBtn");
      btn.src = imagefailed;
      document.body.style.cursor = "default";
      setIsRefreshing(false);
    }
  };

  // Function for button click and refresh images with better error handling
  const handleRefreshClick = async () => {
    if (isRefreshing) return; // Prevent multiple clicks

    try {
      setIsRefreshing(true);
      var btn = document.getElementById("refreshBtn");
      var searchBar = document.getElementById("refreshresult");
      document.body.style.cursor = "wait";
      btn.src = loading;

      // Store the original placeholder
      const originalPlaceholder = searchBar.placeholder;

      console.log("🟡 Starting API calls...");

      // First, test Gmail authentication
      const authTest = await testGmailAuth();
      if (authTest && !authTest.success && authTest.needsReauth) {
        console.log("Gmail authentication needs reauthorization");
        const shouldReauth = confirm(
          "Gmail authentication needs to be renewed. Would you like to reauthorize now?",
        );
        if (shouldReauth) {
          await handleReauthorizeClick();
          // Reset refresh button
          btn.src = refreshgmail;
          document.body.style.cursor = "default";
          setIsRefreshing(false);
          return;
        }
      }

      // Debug image paths first
      await debugImagePaths();

      // Create placeholder images for missing images
      await createPlaceholderImages();

      // More robust API calls with timeouts and response data extraction
      const fetchWithTimeout = async (url, options = {}, timeout = 30000) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
          const response = await fetch(url, {
            ...options,
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          // Try to extract JSON data if present
          let responseData;
          try {
            responseData = await response.clone().json();
          } catch (e) {
            // If not JSON, try to get text
            try {
              responseData = await response.text();
            } catch (e2) {
              responseData = "No response data";
            }
          }

          return {
            ok: response.ok,
            status: response.status,
            statusText: response.statusText,
            data: responseData,
          };
        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }
      };

      // Call both APIs with better error handling
      let imagesResponse, emailsResponse;

      try {
        imagesResponse = await fetchWithTimeout(
          "http://localhost:5000/api/save-images",
          { method: "POST" },
        );
        console.log(
          "🔵 Images Response:",
          imagesResponse.status,
          imagesResponse.data,
        );
      } catch (error) {
        console.error("Error refreshing images:", error);
        imagesResponse = {
          ok: false,
          status: 0,
          statusText: error.message,
          data: null,
        };
      }

      try {
        emailsResponse = await fetchWithTimeout(
          "http://localhost:5000/fetch-emails",
        );
        console.log(
          "🟢 Emails Response:",
          emailsResponse.status,
          emailsResponse.data,
        );
      } catch (error) {
        console.error("Error fetching emails:", error);
        emailsResponse = {
          ok: false,
          status: 0,
          statusText: error.message,
          data: null,
        };
      }

      console.log("🟠 Fetch completed.");

      // Check if images are now properly loading
      const imageCheckResults = await checkImagesLoaded();
      console.log("Image check results:", imageCheckResults);

      // Store last result for reference
      setLastRefreshResult({
        images: imagesResponse,
        emails: emailsResponse,
        imageCheck: imageCheckResults,
      });

      // Success or failure determination including image check
      const imageLoadSuccess = imageCheckResults.some(
        (result) => result.loaded,
      );
      const apiSuccess = imagesResponse.ok && emailsResponse.ok;
      const overallSuccess = apiSuccess && imageLoadSuccess;

      // Reset state - with slight delay to ensure DOM updates
      setTimeout(() => {
        // Update the button image based on the result
        if (!apiSuccess) {
          // API call failure cases
          if (!imagesResponse.ok && !emailsResponse.ok) {
            btn.src = allfailed;
          } else if (!imagesResponse.ok) {
            btn.src = imagefailed;
          } else if (!emailsResponse.ok) {
            btn.src = emailfailed;
          }
        } else if (!imageLoadSuccess) {
          btn.src = imagefailed;
        } else {
          // All success
          btn.src = done;
        }

        // Always restore the original placeholder to maintain visual consistency
        searchBar.placeholder = originalPlaceholder;

        // Make sure UI is properly updated
        document.body.style.cursor = "default";
        setIsRefreshing(false);
      }, 500);
    } catch (error) {
      console.error("Error during refresh:", error);
      var btn = document.getElementById("refreshBtn");
      var searchBar = document.getElementById("refreshresult");
      btn.src = allfailed;

      // Keep the original placeholder
      searchBar.placeholder = "-.⊹˖ᯓ★. ݁₊";

      document.body.style.cursor = "default";
      setIsRefreshing(false);
    }
  };

  const [clickCount, setClickCount] = useState(0);

  const changeToDog = () => {
    const dogButton = document.getElementById("dog");
    dogButton.src = dog;
    dogButton.setAttribute(
      "style",
      `height: 100px;
      width: 100px;
      margin-left: -50px;
      margin-top: -50px;`,
    );

    // Click 5 times, open dev tools
    if (clickCount === 5) {
      ipcRenderer.send("open-devtools");
      setClickCount(0);
    } else {
      setClickCount(clickCount + 1);
    }
  };

  // Add extra diagnostic button for quick debugging
  const showLastResult = () => {
    if (lastRefreshResult) {
      console.log("Last refresh result:", lastRefreshResult);
      alert(
        JSON.stringify(
          {
            emailsStatus: lastRefreshResult.emails.status,
            imagesStatus: lastRefreshResult.images.status,
            imagesLoaded: lastRefreshResult.imageCheck
              .map((img) => img.loaded)
              .join(", "),
          },
          null,
          2,
        ),
      );
    }
  };

  const handleManualReauthorize = () => {
    try {
      // Open the reauthorization URL directly
      const authWindow = window.open(
        "http://localhost:5000/api/reauthorize-direct",
        "_blank",
      );

      if (!authWindow) {
        alert("Please allow popups for this site to complete authorization");
      } else {
        alert(
          "Please follow the instructions in the opened browser window to reauthorize Gmail access.",
        );
      }
    } catch (error) {
      console.error("Error opening reauthorization window:", error);
      alert("Failed to open reauthorization window: " + error.message);
    }
  };

  return (
    <div className={styles.footerContainer}>
      <div
        className={styles.boxButton}
        title="Left-click: Refresh emails | Right-click: Reprocess images"
        style={{
          opacity: isRefreshing ? 0.7 : 1,
          cursor: isRefreshing ? "not-allowed" : "pointer",
        }}
      >
        <img
          id="refreshBtn"
          className={styles.buttonText}
          src={refreshgmail}
          alt="refreshgmail button"
          onClick={handleRefreshClick}
          onContextMenu={handleReprocessImages}
          onDoubleClick={showLastResult}
        />
      </div>
      <input
        id="refreshresult"
        type="text"
        placeholder="-.⊹˖ᯓ★. ݁₊"
        className={styles.searchBar}
        value={query}
        onChange={handleChange}
      />
      <div
        className={styles.boxButton}
        style={{
          position: "relative",
        }}
      >
        <img
          id="dog"
          className={`${styles.buttonText}`}
          src={copytocarrd}
          alt="now its a dog button"
          onClick={changeToDog}
        />
      </div>
    </div>
  );
};

export default FooterBtn;
