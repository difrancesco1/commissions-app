import React, { useState, useEffect } from "react";
import styles from "./card.module.css";

import { db } from "../firebaseConfig";
import {
  collection,
  getDocs,
  orderBy,
  query,
  updateDoc,
  doc,
} from "firebase/firestore";

import loading from "../../../assets/loading.gif";

const fetchDataFromFirestore = async () => {
  // const querySnapshot = await getDocs(collection(db, "commissions"));
  const sectionsCollectionRef = collection(db, "commissions");
  const q = query(
    sectionsCollectionRef,
    orderBy("ARCHIVE"),
    orderBy("PAID", "desc"),
    orderBy("DUE"),
  );
  const querySnapshot = await getDocs(q);

  const data = [];
  querySnapshot.forEach((doc) => {
    data.push({ id: doc.id, ...doc.data() });
  });
  return data;
};

const Card = ({ user, setCommissionIndex }) => {
  const [data, setData] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const newData = await fetchDataFromFirestore();
      setData(newData);
    };

    fetchData();
  }, []);

  const contextMenu = document.getElementById("contextMenu");

  const handleClick = (id) => {
    setCommissionIndex(id);
    handleCloseMenu;
    console.log(id);
  };

  const togglePaid = async () => {
    try {
      const documentRef = doc(db, "commissions", user.id);
      await updateDoc(documentRef, {
        ["PAID"]: `${!user.PAID}`,
      });
      console.log("paid toggled!");
    } catch (error) {
      console.error("Error toggling paid:", error);
    }
  };

  const toggleArchive = async () => {
    try {
      const documentRef = doc(db, "commissions", user.id);
      await updateDoc(documentRef, {
        ["ARCHIVE"]: `${!user.ARCHIVE}`,
      });
      console.log("archive toggled!");
    } catch (error) {
      console.error("Error toggling archive:", error);
    }
  };

  // right click handling
  const [menuVisible, setMenuVisible] = useState(false);
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);

  const handleContextMenu = (event) => {
    event.preventDefault();
    setMouseX(event.clientX);
    setMouseY(event.clientY);
    setMenuVisible(true);
  };

  const handleCloseMenu = () => {
    setMenuVisible(false);
  };

  // TODO: CHANGE THIS TO ACTUALLY BE LOGICAL ^_^
  const imageExists = false;

  return (
    <div
      key={user.id}
      className={styles.cardContainer}
      onClick={() => handleClick(user.id)}
    >
      <div
        key={user.id}
        className={`
          ${user.ARCHIVE === true ? styles.cardArchive : null}
          ${imageExists === true ? styles.card : styles.loadingCardStyle}`}
        onClick={() => handleClick(user.id)}
        onContextMenu={handleContextMenu}
      >
        <img
          className={`${imageExists === true ? styles.image : styles.loadingStyle}`}
          src={`${imageExists === true ? user.IMG1 : loading}`} // TODO: CHANGE USER.IMG1
          alt={user.NAME}
        />
      </div>
      <div onContextMenu={handleContextMenu} className={styles.wrapper}>
        {menuVisible && (
          <div onClick={handleCloseMenu} onMouseLeave={handleCloseMenu}>
            <ul>
              <li className={styles.item} onClick={togglePaid}>
                $
              </li>
              <li className={styles.item} onClick={toggleArchive}>
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
