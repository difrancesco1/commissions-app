import React, { useState, useEffect } from "react";
import styles from "./card.module.css";
import loading from "../../../assets/loading.gif";
import { db } from "../firebaseConfig";
import {
  collection,
  getDocs,
  orderBy,
  query,
  updateDoc,
  doc,
} from "firebase/firestore";

// fetches data from Firestore
const fetchDataFromFirestore = async () => {
  const sectionsCollectionRef = collection(db, "commissions"); // gets "commissions" collection from DB
  const q = query(               // Creates query that orders the docs by: ARCHIVE, PAID, and DUE
    sectionsCollectionRef,
    orderBy("ARCHIVE"),
    orderBy("PAID", "desc"),     // Descending Order
    orderBy("DUE")
  );
  // snapshot iterates through the fetched docs and extracts their data
  const querySnapshot = await getDocs(q); // Fetches the docs based on our query

  const data = [];
  querySnapshot.forEach((doc) => {
    data.push({ id: doc.id, ...doc.data() });
  });
  return data;
};


const Card = ({ user, setCommissionIndex }) => {
  const [data, setData] = useState([]); //data store the fetched data 
  const [imageExists, setImageExists] = useState(false); // imageExists stores whether an image exists or not 

  const imagePath = `http://localhost:5000/API/images/${user.ID}.png`; // URL pointing towards server API endpoint

  // fetch image from the imagePath
  const loadImage = async () => {
    try {
      const imageCheck = await fetch(imagePath);
      if (imageCheck.ok) {
        setImageExists(true); // Image exists, set state to true
      } else {
        setImageExists(false); // Image doesn't exist, set state to false
      }
    } catch (error) {
      setImageExists(false); // Error handling: set state to false if image fetch fails
    }
  };

  // when user.ID changes
  useEffect(() => {
    const fetchData = async () => {                   // Calls db to set new data
      const newData = await fetchDataFromFirestore();
      setData(newData);
    };

    fetchData(); 
    loadImage(); // Checks if the image exists by calling the loadImage function
  }, [user.ID]); // [user.ID] ensures that the effect will ONLY run when user.ID changes ^_^

  //When user clicks on card
  const handleClick = (id) => { 
    setCommissionIndex(id); // sets commission index
    handleCloseMenu(); // closes context menu
  };

  // Toggles the PAID status of a commission in DB
  const togglePaid = async () => {
    try { 
      const documentRef = doc(db, "commissions", user.id);
      await updateDoc(documentRef, {
        ["PAID"]: `${!user.PAID}`,
      });
      console.log("paid status toggled :PP");
    } catch (error) {
      console.error("Error toggling de paid status:", error);
    }
  };

  // Toggles Archive Status
  const toggleArchive = async () => {
    try {
      const documentRef = doc(db, "commissions", user.id);
      await updateDoc(documentRef, {
        ["ARCHIVE"]: `${!user.ARCHIVE}`,
      });
      console.log("archive status toggled :PP");
    } catch (error) {
      console.error("Error toggling de archive:", error);
    }
  };

  // right click handling
  // menuVisible hides and shows context menu
  const [menuVisible, setMenuVisible] = useState(false);
  // Stores the mouse coords when right-clicking
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  //Prevents default rightclick menu
  const handleContextMenu = (event) => {
    event.preventDefault();
    setMouseX(event.clientX);
    setMouseY(event.clientY);
    setMenuVisible(true);
  };
  // Hides context menu when triggered
  const handleCloseMenu = () => {
    setMenuVisible(false);
  };

  return (
    <div
      key={user.id}
      className={styles.cardContainer}
      onClick={() => handleClick(user.id)}
    >
      <div
        key={user.id}
        className={`${
          user.ARCHIVE === true ? styles.cardArchive : null
        } ${imageExists ? styles.card : styles.loadingCardStyle}`}
        onClick={() => handleClick(user.id)}
        onContextMenu={handleContextMenu}
      >
        <img
          className={`${imageExists ? styles.image : styles.loadingStyle}`}
          src={imageExists ? imagePath : loading}
          alt={user.NAME}
        />
      </div>

      <div onContextMenu={handleContextMenu} className={styles.wrapper}>
        {menuVisible && (
          <div onClick={handleCloseMenu} onMouseLeave={handleCloseMenu}>
            <ul>
            <li className={styles.item} onClick={() => {
              console.log("Toggling Paid");
              togglePaid();
            }}>
              $
            </li>
            <li className={styles.item} onClick={() => {
              console.log("Toggling Archive");
              toggleArchive();
            }}>
              ▾
            </li>
            </ul>
          </div>
        )}
      </div>

      <h1
        className={`${styles.cardText} 
          ${user.PAID === true ? null : styles.textNotPaid} 
          ${user.ARCHIVE === true ? styles.textArchive : null}`}
      >
        {user.TWITTER}
        {user.COMPLEX === true ? "⋆" : null}
      </h1>
    </div>
  );
};

export default Card;
