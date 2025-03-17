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
  getDoc,
  Timestamp,
} from "firebase/firestore";
// const contextMenu = document.getElementById("contextMenu");

// fetches data from Firestore
const fetchDataFromFirestore = async () => {
  const sectionsCollectionRef = collection(db, "commissions"); // gets "commissions" collection from DB
  const q = query(
    // Creates query that orders the docs by: ARCHIVE, PAID, and DUE
    sectionsCollectionRef,
    orderBy("ARCHIVE"),
    orderBy("PAID", "desc"), // Descending Order
    orderBy("DUE"),
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

  // when application breathes
  useEffect(() => {
    const fetchData = async () => {
      // Calls db to set new data
      const newData = await fetchDataFromFirestore();
      setData(newData);
    };

    fetchData();
    loadImage(); // Checks if the image exists by calling the loadImage function
  }, [user.ID]);

  //When user clicks on card
  const handleClick = (id) => {
    setCommissionIndex(id); // sets commission index
    // handleCloseMenu();
  };

  // Toggles the PAID status of a commission in DB
  const togglePaid = async () => {
    try {
      const payStatus = !user.PAID;
      const documentRef = doc(db, "commissions", user.id);
      await updateDoc(documentRef, {
        PAID: Boolean(payStatus),
      });
      console.log("set user to " + payStatus);
      // if user paid, update due date
      if (payStatus) {
        // get due date
        const docSnap = await getDoc(
          doc(db, "commissionDueDate", user.COMM_TYPE.slice(0, 3)),
        );

        // set due date as incremented date (server and user)
        if (docSnap.exists()) {
          const dueDate = new Date(Object.values(docSnap.data())[0].toDate());
          dueDate.setDate(dueDate.getDate() + 1);

          // update database with incremented due date
          const updateCommissionDueDate = doc(
            db,
            "commissionDueDate",
            user.COMM_TYPE.slice(0, 3),
          );
          await updateDoc(updateCommissionDueDate, {
            COMM_START_DATE: dueDate,
          });

          // update user due date with integer of due date
          const updateUserDueDate = doc(db, "commissions", user.id);
          await updateDoc(updateUserDueDate, {
            DUE: dueDate,
          });

          console.log(user.id + " paid, set due date: " + dueDate);
        } else {
          // docSnap.data() will be undefined in this case
          console.log("Due date not found in database commissionDueDate.");
        }
      }
    } catch (error) {
      console.error("Error toggling de paid status:", error);
    }
  };

  // Toggles Archive Status
  const toggleArchive = async () => {
    try {
      const archiveStatus = !user.ARCHIVE;
      const archiveRef = doc(db, "commissions", user.id);
      await updateDoc(archiveRef, {
        ARCHIVE: Boolean(archiveStatus),
      });
      console.log("archive status toggled :PP " + archiveStatus);
    } catch (error) {
      console.error("Error toggling de archive:", error);
    }
  };

  return (
    <div key={user.id} className={styles.cardContainer}>
      <div
        key={user.id}
        className={`${
          user.ARCHIVE === true ? styles.cardArchive : null
        } ${imageExists ? styles.card : styles.loadingCardStyle}`}
        // onContextMenu={handleContextMenu}
        onClick={() => handleClick(user.id)}
      >
        <img
          className={`${imageExists ? styles.image : styles.loadingStyle}`}
          src={imageExists ? imagePath : loading}
          alt={user.NAME}
        />
      </div>
      <div id="contextMenu" className={styles.wrapper}>
        <ul className={styles.menu}>
          <li className={styles.item} onClick={togglePaid}>
            ▴
          </li>
          <li className={styles.item} onClick={toggleArchive}>
            ▾
          </li>
        </ul>
      </div>
      <h1
        className={`${styles.cardText} 
          ${user.PAID === true ? null : styles.textNotPaid} 
          ${user.ARCHIVE === true ? styles.textArchive : null}`}
        onClick={() => handleClick(user.id)}
      >
        {user.EMAIL_WIP === true ? "»" : null}
        {user.TWITTER}
        {user.COMPLEX === true ? "⋆" : null}
      </h1>
    </div>
  );
};

export default Card;
