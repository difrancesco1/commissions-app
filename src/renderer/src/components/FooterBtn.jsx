import React, { useState } from "react";
import styles from "./footerBtn.module.css";
import refreshgmail from "../../../assets/refreshgmail.png";
import copytocarrd from "../../../assets/copytocarrd.png";
import loading from "../../../assets/loading.gif";
import done from "../../../assets/done.png";

const FooterBtn = ({ setSearchQuery }) => {
  const [query, setQuery] = useState(""); // Local state for the search query

  // Handle input change and update the parent component
  const handleChange = (e) => {
    setQuery(e.target.value); // Update local state
    setSearchQuery(e.target.value); // Pass the query to the parent component
  };

  // Function for button click and refresh images
  const handleRefreshClick = async () => {
    try {
      var btn = document.getElementById("refreshBtn");
      document.body.style.cursor = "wait";
      btn.src = loading;
      const response = await fetch("http://localhost:5000/api/save-images", {
        //points to our server api that has the save image path/script
        method: "POST",
      });
      btn.src = done;
      if (response.ok) {
        console.log("Images refreshed successfully"); // if the POST is successful (even if no images need to be updated)
      } else {
        console.error("Failed to refresh images");
        alert("Failed to refresh images.");
      }
    } catch (error) {
      console.error("Error during refresh:", error);
      alert("Error during refresh. Please try again.");
    }
    document.body.style.cursor = "default";
  };

  return (
    <div className={styles.footerContainer}>
      <div className={styles.boxButton} onClick={handleRefreshClick}>
        <img
          id="refreshBtn"
          className={styles.buttonText}
          src={refreshgmail}
          alt="refreshgmail button"
        />
      </div>

      <input
        type="text"
        placeholder="-.⊹˖ᯓ★. ݁₊"
        className={styles.searchBar}
        value={query} // Bind input value to local state
        onChange={handleChange} // Call handleChange on input change
      />

      <div className={styles.boxButton}>
        <img
          className={styles.buttonText}
          src={copytocarrd}
          alt="copytocarrd button"
        />
      </div>
    </div>
  );
};

export default FooterBtn;
