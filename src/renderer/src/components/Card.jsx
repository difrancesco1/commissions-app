import React, { useState, useEffect } from "react";
import styles from "./card.module.css";

import { db } from "../firebaseConfig";
import { collection, getDocs } from "firebase/firestore";

const fetchDataFromFirestore = async () => {
  const querySnapshot = await getDocs(collection(db, "commissions"));
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

  const contextMenu = document.getElementById('contextMenu');

  const handleClick = (id) => {
    setCommissionIndex(id);
    contextMenu.style.display = "none";
    console.log(id);
  };

  const handleRightClick = (event) => {
    event.preventDefault();
    console.log('Right click event triggered');
    contextMenu.style.display = "flex";
  };

  return (
    <div key={user.id} className={styles.cardContainer} 
      onClick={() => handleClick(user.id)}>
        <div key={user.id} className={`${styles.card} ${user.ARCHIVE === true ? styles.cardArchive : null}`} 
          onClick={() => handleClick(user.id)} onContextMenu={handleRightClick}>
          <img
            className={styles.image}
            src={user.IMG1}
            alt={user.NAME}
        />
        </div>
        <div id="contextMenu" className={styles.wrapper}>
          <ul className = {styles.menu}>
            <li className = {styles.item}>
              $
            </li>
            <li className = {styles.item}>
              ▾
            </li>
          </ul>
        </div>
        <h1 className={`${styles.cardText} 
          ${user.PAID === true ? null : styles.textNotPaid} 
          ${user.ARCHIVE === true ? styles.textArchive : null}`}
        >{user.TWITTER}</h1>
    </div>
  );
};

export default Card;