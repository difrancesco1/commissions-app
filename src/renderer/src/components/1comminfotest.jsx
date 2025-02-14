// CommissionInfo.jsx
import React, { useState, useEffect, useMemo } from "react";
import styles from "./commissionInfo.module.css";
import CommissionInfoImg from "./CommissionInfoImg";

import { db } from "../firebaseConfig";
import {
  collection,
  orderBy,
  query,
  onSnapshot,
  doc,
  updateDoc,
  where,
} from "firebase/firestore";
import CommissionInfoText from "./CommissionInfoText";

import EmailButtonContainer from "./EmailButtonContainer"; // Import new component

const CommissionInfo = ({ commissionIndex, searchQuery, listCount }) => {
  const [userData, setUserData] = useState([]);
  const [paidUsers, setPaidUsers] = useState([]);
  const [archiveUsers, setarchiveUsers] = useState([]);

  useEffect(() => {
    var q = query(
      collection(db, "commissions"),
      orderBy("ARCHIVE"),
      orderBy("PAID", "desc"),
      orderBy("DUE"),
    );

    var unsubscribe = onSnapshot(q, (snapshot) => {
      const newData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      console.log("Updated Firestore Data:", newData); // Debugging log
      setUserData(newData);
    });

    q = query(
      collection(db, "commissions"),
      where("PAID", "==", Boolean(true)),
      where("ARCHIVE", "==", Boolean(false)),
    );
    unsubscribe = onSnapshot(q, (snapshot) => {
      const paidUsers = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      console.log("amount of users paid:", paidUsers.length); // Debugging log
      setPaidUsers(paidUsers);
    });

    q = query(
      collection(db, "commissions"),
      where("ARCHIVE", "==", Boolean(true)),
    );
    unsubscribe = onSnapshot(q, (snapshot) => {
      const archiveUsers = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      console.log("amount of users archived:", archiveUsers.length); // Debugging log
      setarchiveUsers(archiveUsers);
    });

    return () => unsubscribe();
  }, []);

  const selectedCommission = useMemo(() => {
    return userData.find((user, index) =>
      commissionIndex ? user.id === commissionIndex : index === 0,
    );
  }, [userData, commissionIndex]);

  const [menuVisible, setMenuVisible] = useState(false);

  // right click handling
  const handleContextMenu = (event, buttonId, userId) => {
    event.preventDefault();
    let menu = document.getElementById("contextMenuEmailButton");
    menu.style.left = event.clientX + "px";
    menu.style.top = event.clientY + "px";
    window.x = event.clientX;
    // Update the database with the clicked button's action for the given user
    copyEmail(buttonId, userId);
    setMenuVisible(true);
  };

  const copyEmail = (buttonId, userId) => {
    // Handle button click action here
    updateEmailDatabase(buttonId, userId);
  };

  const updateEmailDatabase = async (fieldName, userId) => {
    try {
      const documentRef = doc(db, "commissions", userId);
      await updateDoc(documentRef, {
        [fieldName]: true,
      });
      console.log("updated as true: " + fieldName);
    } catch (error) {
      console.error("Error toggling de email:", error);
    }
  };

  const handleCloseMenu = () => {
    setMenuVisible(false);
  };

  return (
    <div className={styles.commissionInfo}>
      <div className={styles.clientInfo}>
        {selectedCommission && (
          <CommissionInfoImg
            commissionIndex={commissionIndex}
            user={selectedCommission}
          />
        )}

        {selectedCommission && (
          <CommissionInfoText
            commissionIndex={commissionIndex}
            user={selectedCommission}
          />
        )}
      </div>

      {/* Use the new EmailButtonContainer here */}
      {selectedCommission && (
        <EmailButtonContainer
          userId={selectedCommission.id}
          onContextMenuHandler={handleContextMenu}
        />
      )}

      <div
        id="contextMenuEmailButton"
        onContextMenu={handleContextMenu}
        className={styles.wrapper}
      >
        {menuVisible && (
          <div onClick={handleCloseMenu} onMouseLeave={handleCloseMenu}>
            <ul>
              <li className={styles.item} onClick={copyEmail}>
                ✉
              </li>
            </ul>
          </div>
        )}
      </div>

      <div>
        <div className={styles.todoCountText}>
          ▾todo({paidUsers.length}/{listCount - archiveUsers.length})
        </div>
      </div>
    </div>
  );
};

export default CommissionInfo;
