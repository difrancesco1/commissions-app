import React, { useState, useEffect } from "react";
import styles from "./CommissionInfo.module.css";
import "../assets/base.css";
import { db } from "../firebaseConfig";
import { doc, updateDoc } from "firebase/firestore";

const updateData = async (id, newNotes) => {
  try {
    const docRef = doc(db, "commissions", id);
    await updateDoc(docRef, { NOTES: newNotes });
    console.log("Document updated successfully!");
  } catch (e) {
    console.error("Error updating document: ", e);
  }
};

function CommissionInfoText({ user, count }) {
  const [notes, setNotes] = useState(user.NOTES || ""); // Set initial value
  const [dueDate, setDueDate] = useState([]);
  const [recieveDate, setRecieveDate] = useState([]);

  // Ensure state updates when `user.NOTES` changes
  useEffect(() => {
    setNotes(user.NOTES || ""); // Update state if Firestore data changes
  }, [user.NOTES]);

  useEffect(() => {
    try {
      const databaseDueDate = new Date(user.DUE.toDate());
      const dueDate = `${databaseDueDate.getMonth() + 1}/${databaseDueDate.getDate()}`;
      setDueDate(dueDate);
    } catch {
      console.log("no due date set yet for user " + user.ID);
      setDueDate("");
    }
    try {
      const databsePayDue = new Date(user.PAYDUE.toDate());
      databsePayDue.setDate(databsePayDue.getDate() - 30);
      const recieveDate = `${databsePayDue.getMonth() + 1}/${databsePayDue.getDate()}`;
      setRecieveDate(recieveDate);
    } catch {
      console.log("couldn't calculate email recieved date for user " + user.ID);
    }
  }, [user.DUE, user.PAYDUE]);

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      updateData(user.id, notes);
      document.getElementById("setNote").blur();
    }
  };

  const x = parseInt(count) - 1;

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
          id="setNote"
          type="text"
          className={`${styles.noteText} ${styles.placeholderText}`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)} // Make input editable
          onKeyDown={handleKeyDown}
          onBlur={() => updateData(user.id, notes)} // Update Firestore on blur
        />
        <p
          className={styles.subText}
          onClick={() => {
            navigator.clipboard.writeText(user.TWITTER);
          }}
        >
          {user.TWITTER}
        </p>
        <p
          className={styles.subsubText}
          onClick={() => {
            navigator.clipboard.writeText(user.EMAIL);
          }}
        >
          {user.EMAIL}
        </p>
        <p
          className={styles.subsubText}
          onClick={() => {
            navigator.clipboard.writeText(user.PAYPAL);
          }}
        >
          {user.PAYPAL}
        </p>
        <p className={`${styles.noteText} ${styles.formatTextSize}`}>
          {x}⨯˚ʚᗢ₍^.ˬ.^₎₍ᐢ.ˬ.ᐢ₎♡.°₊ˎˊ˗
        </p>
      </div>
      <div className={styles.dueInfo}>
        <p className={styles.subsubText}>{recieveDate}↴</p>
        <p className={styles.subText}>{dueDate}</p>
        <p className={styles.subText}>{user.COMM_TYPE}</p>
      </div>
    </>
  );
}

export default CommissionInfoText;
