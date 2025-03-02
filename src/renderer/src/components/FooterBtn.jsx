import React, { useState } from "react";
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

  // Handle input change and update the parent component
  const handleChange = (e) => {
    setQuery(e.target.value); // Update local state
    setSearchQuery(e.target.value); // Pass the query to the parent component
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

      // Set a default message while loading
      searchBar.placeholder = "refreshing...";

      // More robust API calls with timeouts
      const fetchWithTimeout = async (url, options = {}, timeout = 30000) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
          const response = await fetch(url, {
            ...options,
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          return response;
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
        console.log("🔵 Images Response:", imagesResponse.status);
      } catch (error) {
        console.error("Error refreshing images:", error);
        imagesResponse = { ok: false, status: 0, statusText: error.message };
      }

      try {
        emailsResponse = await fetchWithTimeout(
          "http://localhost:5000/fetch-emails",
        );
        console.log("🟢 Emails Response:", emailsResponse.status);
      } catch (error) {
        console.error("Error fetching emails:", error);
        emailsResponse = { ok: false, status: 0, statusText: error.message };
      }

      console.log("🟠 Fetch completed.");

      // Display response to user
      if (!imagesResponse.ok && !emailsResponse.ok) {
        // Both image and email pull failed
        btn.src = allfailed;
        searchBar.placeholder = "server error - both operations failed";
      } else if (!imagesResponse.ok) {
        // Image loading failed
        btn.src = imagefailed;
        searchBar.placeholder = `image refresh failed (${imagesResponse.status})`;
      } else if (!emailsResponse.ok) {
        // Email loading failed
        btn.src = emailfailed;

        // Try to get more details from the response
        let errorDetails = emailsResponse.statusText;
        if (emailsResponse.status === 500) {
          try {
            const errorData = await emailsResponse.json();
            if (errorData && errorData.message) {
              errorDetails = errorData.message.substring(0, 30);
            }
          } catch (e) {
            // Ignore JSON parsing errors
          }
        }

        searchBar.placeholder = `email refresh failed: ${errorDetails}`;
      } else {
        // All success
        btn.src = done;
        searchBar.placeholder = "-.⊹˖ᯓ★. ݁₊";
      }
    } catch (error) {
      console.error("Error during refresh:", error);
      btn.src = allfailed;
      searchBar.placeholder = error.message.toLowerCase();
    } finally {
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

  return (
    <div className={styles.footerContainer}>
      <div
        className={styles.boxButton}
        onClick={handleRefreshClick}
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
        />
      </div>
      <input
        id="refreshresult"
        type="text"
        placeholder="-.⊹˖ᯓ★. ݁₊"
        className={styles.searchBar}
        value={query} // Bind input value to local state
        onChange={handleChange} // Call handleChange on input change
      />
      <div className={styles.boxButton}>
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
