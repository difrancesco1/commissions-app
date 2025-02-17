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

  // Handle input change and update the parent component
  const handleChange = (e) => {
    setQuery(e.target.value); // Update local state
    setSearchQuery(e.target.value); // Pass the query to the parent component
  };

  // Function for button click and refresh images
  const handleRefreshClick = async () => {
    try {
      var btn = document.getElementById("refreshBtn");
      var searchBar = document.getElementById("refreshresult");

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

      // display response to user
      if (!imagesResponse.ok && !emailsResponse.ok){
        // both image and email pull failed
        btn.src = allfailed;
        searchBar.placeholder = "failure";
      }
      else if(!imagesResponse.ok){
        // image loading failed
        btn.src = imagefailed;
        searchBar.placeholder = "image refresh failed";
      } else if(!emailsResponse.ok){
        // email loading failed
        btn.src = emailfailed;
        searchBar.placeholder = "email refresh failed";
      } else{
        // all success
        btn.src = done;
        searchBar.placeholder = "-.⊹˖ᯓ★. ݁₊"; // try catch didn't fail. replace search bar error 
      }

    } catch (error) {
      console.error("Error during refresh:", error);
      btn.src = allfailed;
      searchBar.placeholder = error.message.toLowerCase();
    }
    document.body.style.cursor = "default";
  };

  const [clickCount, setClickCount] = useState(0);
  const changeToDog = () => {
    const dogButton = document.getElementById("dog");
    dogButton.src = dog;
    dogButton.setAttribute(
      "style",
      `  height: 100px;
      width: 100px;
      margin-left: -50px;
      margin-top: -50px;`,
    );

    // click 5 times, open dev tools
    if (clickCount == 5) {
      ipcRenderer.send("open-devtools");
      setClickCount(0);
    } else {
      setClickCount(clickCount + 1);
    }
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
        id= "refreshresult"
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
