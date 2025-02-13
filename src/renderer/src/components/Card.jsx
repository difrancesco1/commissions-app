import React, { useState, useEffect } from "react";
import styles from "./card.module.css";

import { db } from "../firebaseConfig";
import { collection, getDocs, orderBy, query } from "firebase/firestore";

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
    contextMenu.style.display = "none";
    console.log(id);
  };

  const handleRightClick = (event) => {
    event.preventDefault();
    console.log("Right click event triggered");
    contextMenu.style.display = "flex";
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
        onContextMenu={handleRightClick}
      >
        <img
          className={`${imageExists === true ? styles.image : styles.loadingStyle}`}
          src={`${imageExists === true ? user.IMG1 : loading}`} // TODO: CHANGE USER.IMG1
          alt={user.NAME}
        />
      </div>
      <div id="contextMenu" className={styles.wrapper}>
        <ul className={styles.menu}>
          <li className={styles.item}>$</li>
          <li className={styles.item}>▾</li>
        </ul>
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
