import React, { useState, useEffect } from 'react'
import Card from './Card.jsx'
import styles from './cardContainer.module.css'
import content from '../../../content.js'

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
const CardContainer = ( { commissionIndex, setCommissionIndex } ) => {

  const [userData, setUserData] = useState([]);

  useEffect(() => {
    async function fetchData() {
      const data = await fetchDataFromFirestore();
      setUserData(data);
      
    }
    fetchData();
  }, []);
  return (
    <div className={styles.container}>
      {userData.map((user) => (
        <Card 
        commissionIndex={commissionIndex}
        setCommissionIndex={setCommissionIndex}
        key={user.id} 
        user={user} />
      ))}
    </div>
  )
}

export default CardContainer
