import React, { useState, useEffect } from "react";
import styles from "./card.module.css";

import { db } from "../firebaseConfig";
import { collection, getDocs, orderBy, query } from "firebase/firestore";

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
    <div className={styles.cardContainer}>
        <div key={user.id} className={styles.card} onClick={() => handleClick(user.id)}>
          <img className={styles.image} src={user.image} alt={user.NAME} />
          <h1 className={styles.cardText}>{user.TWITTER}</h1>
        </div>
    </div>
  );
};

export default Card;


import React, { useState, useEffect } from 'react'
import styles from './card.module.css'

import { db } from "../firebaseConfig"; // Import Firestore
import { collection, getDocs } from "firebase/firestore";

async function fetchDataFromFirestore() {
    const querySnapshot = await getDocs(collection(db, "commissions"))
  
    const data = [];
    querySnapshot.forEach((doc) => {
      data.push({ id: doc.id, ...doc.data()})
    });
    return data;
  }

const Card = ({user, commissionIndex, setCommissionIndex }) => {
    const fetchData = async () => {
        const response = await fetch(data)
        const key = await response
        setData(newData)
    }
    return (
        <div className={styles.cardContainer}>
            <div className={styles.card}>
                <img 
                    className={styles.image}
                    src={user.image} 
                    alt={user.name}
                />
            </div>
            <h1 className={styles.cardText}>{user.TWITTER}</h1>
        </div>
    )
}

export default Card
