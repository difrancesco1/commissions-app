import React, { useState, useEffect } from "react";
import Card from "./Card.jsx";
import styles from "./cardContainer.module.css";
import notfound from "../../../assets/notfound.gif";
import { db } from "../firebaseConfig"; // Import Firestore
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
} from "firebase/firestore";

const CardContainer = ({
  commissionIndex,
  setCommissionIndex,
  searchQuery,
  setListCount,
}) => {
  const [userData, setUserData] = useState([]);

  useEffect(() => {
    const sectionsCollectionRef = collection(db, "commissions");
    const q = query(
      sectionsCollectionRef,
      orderBy("ARCHIVE"),
      orderBy("PAID", "desc"),
      orderBy("DUE"),
    );

    // Listen for real-time updates
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setUserData(data);
    });

    return () => unsubscribe();
  }, []);

  // Normalize to lowercase and remove spaces
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  // Filter the user data based on the search query (matches TWITTER or PAYPAL)
  const filteredData = userData.filter((user) => {
    const userTwitter = user.TWITTER ? user.TWITTER.trim().toLowerCase() : "";
    const userPaypal = user.PAYPAL ? user.PAYPAL.trim().toLowerCase() : "";
    const userName = user.NAME ? user.NAME.trim().toLowerCase() : "";
    const userEmail = user.EMAIL ? user.EMAIL.trim().toLowerCase() : "";
    const userNotes = user.NOTES ? user.NOTES.trim().toLowerCase() : "";

    return (
      userTwitter.includes(normalizedSearchQuery) ||
      userPaypal.includes(normalizedSearchQuery) ||
      userName.includes(normalizedSearchQuery) ||
      userEmail.includes(normalizedSearchQuery) ||
      userNotes.includes(normalizedSearchQuery)
    );
  });

  // Update thr parent with the length of cards
  useEffect(() => {
    setListCount(filteredData.length);
  }, [filteredData, setListCount]); //Runs when filteredData changes

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
        <div>
                  <img className={styles.noneFound}
                    src={notfound}
                    alt="searchnotfound"
                  />
        </div> // If there are no results when typing or in general
      )}
    </div>
  );
};

export default CardContainer;
