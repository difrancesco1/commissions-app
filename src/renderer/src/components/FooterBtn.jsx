import React, { useState } from "react";
import styles from "./footerBtn.module.css";
import refreshgmail from "../../../assets/refreshgmail.png";
import copytocarrd from "../../../assets/copytocarrd.png";
import loading from "../../../assets/loading.gif";
import done from "../../../assets/done.png";
import dog from "../../../assets/dog.gif";

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
      // Call both APIs
      const [imagesResponse, emailsResponse] = await Promise.all([
        fetch("http://localhost:5000/api/save-images", { method: "POST" }),
        fetch("http://localhost:5000/fetch-emails"),
      ]);

      console.log("🟠 Fetch completed.");
      console.log("🔵 Images Response:", imagesResponse);
      console.log("🟢 Emails Response:", emailsResponse);

      btn.src = done;

      if (imagesResponse.ok && emailsResponse.ok) {
        console.log("Images refreshed and emails fetched successfully"); // if the POST is successful (even if no images need to be updated)
      } else {
        console.error("One or both requests failed");
        alert("Could not refresh email/images :( ");
      }
    } catch (error) {
      console.error("Error during refresh:", error);
      alert("Error during refresh :(");
      btn.src = done;
    }
    document.body.style.cursor = "default";
  };

  const changeToDog = () => {
    const dogButton = document.getElementById("dog");
    dogButton.src = dog;
    dogButton.setAttribute(
      "style",
      `  height: 100px;
  width: 100px;
  /* margin-bottom: 100px; */
  /* padding-bottom: 100px; */
  margin-left: -50px;
  margin-top: -50px;`,
    );
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
