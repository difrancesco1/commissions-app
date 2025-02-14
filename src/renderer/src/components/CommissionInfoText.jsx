import React, { useState, useEffect } from "react";
import styles from "./CommissionInfo.module.css";
import "../assets/base.css";
import { db } from "../firebaseConfig";
import { doc, updateDoc } from "firebase/firestore";

const updateData = async (id, newNotes) => {
  try {
    const docRef = doc(db, "commissions", id); // Ensure the collection name is correct
    await updateDoc(docRef, { NOTES: newNotes });
    console.log("Document updated successfully!");
  } catch (e) {
    console.error("Error updating document: ", e);
  }
};

function CommissionInfoText({ user }) {
  const [notes, setNotes] = useState(user.NOTES || ""); // Set initial value

  // Ensure state updates when `user.NOTES` changes
  useEffect(() => {
    setNotes(user.NOTES || ""); // Update state if Firestore data changes
  }, [user.NOTES]);

  return (
    <>
      <div className={styles.clientText}>
        <p
          className={`
            ${styles.nameText}
            ${user.ARCHIVE ? styles.textArchive : ""}
            ${user.PAID ? "" : styles.textNotPaid}
          `}
        >
          {user.NAME}
          {user.COMPLEX ? "⋆" : ""}
        </p>
        <input
          type="text"
          className={`${styles.noteText} ${styles.placeholderText}`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)} // Make input editable
          onBlur={() => updateData(user.id, notes)} // Update Firestore on blur
        />
        <p className={styles.subText}>{user.TWITTER}</p>
        <p className={styles.subText}>{user.EMAIL}</p>
        <p className={styles.subText}>{user.PAYPAL}</p>
        <p className={`${styles.noteText} ${styles.formatTextSize}`}>
          ⨯˚ʚᗢ ₍^.ˬ.^₎ ₍ᐢ.ˬ.ᐢ₎ ♡.°₊ˎˊ˗
        </p>
      </div>
      <div className={styles.dueInfo}>
        <p className={styles.subText}>{user.DUE}</p>
        <p className={styles.subText}>{user.COMM_TYPE}</p>
      </div>
    </>
  );
}

export default CommissionInfoText;
