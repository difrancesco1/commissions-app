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

  const handleClick = (id) => {
    setCommissionIndex(id);
    console.log(id);
  };

  return (
    <div key={user.id} className={styles.cardContainer} onClick={() => handleClick(user.id)}>
        <div key={user.id} className={styles.card} onClick={() => handleClick(user.id)}>
          <img 
            className={styles.image} 
            src={user.IMG1} 
            alt={user.NAME} 
        />
        </div>
        <h1 className={styles.cardText}>{user.TWITTER}</h1>
    </div>
  );
};

export default Card;