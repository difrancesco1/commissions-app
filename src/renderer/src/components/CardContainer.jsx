import React, { useState, useEffect } from 'react';
import Card from './Card.jsx';
import styles from './cardContainer.module.css';
import { db } from "../firebaseConfig"; // Import Firestore
import { collection, getDocs } from "firebase/firestore";

// Fetch data from Firestore
async function fetchDataFromFirestore() {
  const querySnapshot = await getDocs(collection(db, "commissions"));
  const data = [];
  querySnapshot.forEach((doc) => {
    data.push({ id: doc.id, ...doc.data() });
  });
  return data;
}

const CardContainer = ({ commissionIndex, setCommissionIndex, searchQuery }) => {
  const [userData, setUserData] = useState([]);

  useEffect(() => {
    async function fetchData() {
      const data = await fetchDataFromFirestore();
      setUserData(data);
    }
    fetchData();
  }, []);

  // Normalize to lowercase and remove (trim) spaces
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  console.log("Search Query: ", normalizedSearchQuery);  // check normalized search query as we type

  // Filter the user data based on the normalized search query, comparing to TWITTER field in db
  const filteredData = userData.filter((user) => {
    // check full object
    console.log("Full user object:", user);

    const userTwitter = user.TWITTER ? user.TWITTER.trim().toLowerCase() : '';  // make sure user.TWITTER is not undefined
    const userPaypal = user.PAYPAL ? user.PAYPAL.trim().toLowerCase() : '';  // make sure user.TWITTER is not undefined

    console.log("Comparing:", userTwitter, "to", normalizedSearchQuery); // debug compare the userTwitter to the search 

    // Check if searchQuery is part of the userTwitter
    return userTwitter.includes(normalizedSearchQuery) || userPaypal.includes(normalizedSearchQuery);

  });

  // Log the number of results
  console.log(`Number of matching results: ${filteredData.length}`);

  return (
    <div className={styles.container}>
      {filteredData.length > 0 ? (
        filteredData.map((user) => (
          <Card
            commissionIndex={commissionIndex}
            setCommissionIndex={setCommissionIndex}
            key={user.id}
            user={user}
          />
        ))
      ) : (
        <div className={styles.noneFound}>♡ no commissions found ૮꒰ ˶• ༝ •˶꒱ა ♡</div> // If there are no results when typing or in general
      )}
    </div>
  );
};

export default CardContainer;
