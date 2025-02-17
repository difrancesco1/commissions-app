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
  deleteDoc,
} from "firebase/firestore";
import CommissionInfoText from "./CommissionInfoText";
import EmailButtonContainer from "./EmailButtonContainer"; // Import new component

const CommissionInfo = ({ commissionIndex, searchQuery, listCount }) => {
  const [userData, setUserData] = useState([]); // Holds the list of all commission data from Firestore
  const [paidUsers, setPaidUsers] = useState([]); // Holds users who have paid
  const [archiveUsers, setArchiveUsers] = useState([]); // Holds users whose commissions are archived
  const [disabledButtons, setDisabledButtons] = useState({}); // Track disabled buttons
  const [menuVisible, setMenuVisible] = useState(false); // Controls whether the context menu is visible when the user right clicks
  const [selectedButtonId, setSelectedButtonId] = useState(null); // Track selected button storing the ID

  useEffect(() => {
    // Fetches all commissions ordered by ARCHIVE, PAID, and DUE
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
      setUserData(newData);
    });

    // Fetches all users who have paid where (PAID = true and ARCHIVE = false)
    q = query(
      collection(db, "commissions"),
      where("PAID", "==", Boolean(true)),
      where("ARCHIVE", "==", Boolean(false)),
    );
    unsubscribe = onSnapshot(q, (snapshot) => {
      // Stores users who have paid and are not archived in paidUsers
      const paidUsers = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setPaidUsers(paidUsers);
    });

    // Fetches users whose commissions are archived (ARCHIVE = true)
    q = query(
      collection(db, "commissions"),
      where("ARCHIVE", "==", Boolean(true)),
    );
    unsubscribe = onSnapshot(q, (snapshot) => {
      // Stores archived users in archiveUsers
      const archiveUsers = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setArchiveUsers(archiveUsers);
    });
    // Stop listeners
    return () => unsubscribe();
  }, []);

  // helps find commission data of currently selected user
  const selectedCommission = useMemo(() => {
    return userData.find(
      (user, index) =>
        commissionIndex ? user.id === commissionIndex : index === 0, // if the commissionIndex is provided, if find the commission with the matching id
    ); // if the commissionIndex is not provided, it will return the first commission in the index
  }, [userData, commissionIndex]);

  // right-click handling
  const handleContextMenu = (event, buttonId, userId) => {
    event.preventDefault(); // Prevents default right-click behavior
    let menu = document.getElementById("contextMenuEmailButton"); // Selects button specific ID
    menu.style.left = event.clientX + "px"; // Pop up where mouse is
    menu.style.top = event.clientY + "px";
    window.x = event.clientX;
    setSelectedButtonId(buttonId); // Track the selected button ID
    setMenuVisible(true); // Show context menu
  };
  useEffect(() => {
    if (selectedCommission) {
      setDisabledButtons({
        [selectedCommission.id]: {
          btn1:
            selectedCommission.EMAIL_PAY && selectedCommission.EMAIL_COMPPAY,
          btn2:
            selectedCommission.EMAIL_PAY &&
            selectedCommission.EMAIL_COMPPAY &&
            selectedCommission.COMPLEX,
          btn3:
            selectedCommission.EMAIL_PAY &&
            selectedCommission.EMAIL_COMPPAY &&
            selectedCommission.COMPLEX,
          btn4:
            selectedCommission.EMAIL_PAY &&
            selectedCommission.EMAIL_COMPPAY &&
            selectedCommission.EMAIL_WIP,
          btn5:
            selectedCommission.EMAIL_PAY &&
            selectedCommission.EMAIL_COMPPAY &&
            selectedCommission.EMAIL_WIP &&
            selectedCommission.EMAIL_COMP,
        },
      });
    }
  }, [selectedCommission]);
  const buttonIdToField = {
    btn1: ["EMAIL_PAY", "EMAIL_COMPPAY"],
    btn2: ["EMAIL_PAY", "COMPLEX", "EMAIL_COMPPAY"],
    btn3: ["EMAIL_PAY", "COMPLEX", "EMAIL_COMPPAY"],
    btn4: ["EMAIL_PAY", "EMAIL_COMPPAY", "EMAIL_WIP"],
    btn5: [
      "EMAIL_PAY",
      "EMAIL_COMPPAY",
      "EMAIL_WIP",
      "EMAIL_COMP",
      "ARCHIVE",
      "COMPLETE",
    ],
  };

  // Triggered when user clicks button in context menu
  const handleContextMenuAction = (buttonId, userId) => {
    const field = buttonIdToField[buttonId];

    if (Array.isArray(field)) {
      // If button updates multiple fields (like btn3)
      field.forEach((f) => updateEmailDatabase(f, userId));
    } else {
      updateEmailDatabase(field, userId);
    }
  };

  // Updates Firestore doc of specific user
  const updateEmailDatabase = async (fieldName, userId) => {
    try {
      const documentRef = doc(db, "commissions", userId);
      await updateDoc(documentRef, {
        [fieldName]: true,
      });
      console.log("Updated as true:", fieldName);
    } catch (error) {
      console.error("Error updating email field:", error);
    }
  };

  const handleCloseMenu = () => {
    setMenuVisible(false);
  };

  // copy to clipboard information to paste into website
  // also put items that are past pay due into archive
  const copyCarrdInfo = async () => {
    var carrdArr = [];
    for (const id in userData) {
      const user = userData[id];

      // today's date + commission due date
      const todayDate = new Date();
      const commDue = new Date(user.PAYDUE.toDate());
      // commission due date + 7 days
      const weekFromPayDue = new Date(user.PAYDUE.toDate());
      weekFromPayDue.setDate(weekFromPayDue.getDate() + 14);

      // if data is in archive,
      if (user.ARCHIVE) {
        // if today is 14 days past paydue, delete entry. if deleted entry, continue.
        if (todayDate > weekFromPayDue) {
          await deleteDoc(doc(db, "commissions", user.ID));
          continue;
        }
        if (!user.COMPLETE) {
          // if not complete, skip over to not have entry listed in carrd website
          continue;
        }
      }

      // if user didn't pay, check that user didn't miss the pay date. if they missed pay date, move to archive
      if (!user.PAID) {
        // PAYDATE HAS BEEN PASSED
        if (todayDate > commDue) {
          const documentRef = doc(db, "commissions", user.id);
          await updateDoc(documentRef, {
            ARCHIVE: Boolean(true),
          });
          console.log(
            "archived " + user.id + " due to payment not being made in 30 days",
          );
        }
      }

      // clean twitter name to not have any symbols
      const twitter = user.TWITTER;
      const noUnderscoreTwitter = twitter.replace(/[^a-zA-Z0-9\s]/g, "");

      // add due date if there is a due date
      // format information for website
      try {
        const commmDue = new Date(user.DUE.toDate());
        const dueDate = `${commmDue.getMonth() + 1}/${commmDue.getDate()}`;

        carrdArr.push(
          `♡ ${dueDate} ♡ ==${user.COMPLEX ? "★" : ""}${noUnderscoreTwitter}== `,
        );
        carrdArr.push(`${user.PAID ? " paid✔" : " pending ~"}`);
        carrdArr.push(`${id < 7 ? " ✎working⋆.ೃ࿔*:･" : ""}`);
        carrdArr.push(`${user.COMPLETE ? " ✉!!!" : ""}`);
        carrdArr.push(`\n`);
      } catch {
        carrdArr.push(`^${user.COMPLEX ? "★" : ""}${noUnderscoreTwitter} `);
        carrdArr.push(`${user.PAID ? " paid✔" : " pending ~"}`);
        carrdArr.push(
          `${user.EMAIL_PAY || user.EMAIL_COMP || user.EMAIL_COMPPAY ? " ✉" : ""}^`,
        );
        carrdArr.push(`\n`);
      }
    }
    // console.log(carrdArr.join(""));
    // copy website information to clipboard
    navigator.clipboard.writeText(carrdArr.join(""));
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

      {/* Email Buttons container */}
      {selectedCommission && (
        <EmailButtonContainer
          userId={selectedCommission.id}
          onContextMenuHandler={handleContextMenu}
          disabledButtons={disabledButtons[selectedCommission.id]} // Pass disabled state for the user
          handleContextMenuAction={handleContextMenuAction} // Action handler to disable button
        />
      )}

      <div
        id="contextMenuEmailButton"
        className={styles.wrapper}
        style={{ visibility: menuVisible ? "visible" : "hidden" }}
      >
        {menuVisible && (
          <div onClick={handleCloseMenu} onMouseLeave={handleCloseMenu}>
            <ul>
              <li
                className={styles.item}
                onClick={() =>
                  handleContextMenuAction(
                    selectedButtonId,
                    selectedCommission.id,
                  )
                }
              >
                ✉
              </li>
            </ul>
          </div>
        )}
      </div>

      <div>
        <div className={styles.todoCountText} onClick={copyCarrdInfo}>
          ▾todo({paidUsers.length}/{userData.length - archiveUsers.length})
        </div>
      </div>
    </div>
  );
};

export default CommissionInfo;
