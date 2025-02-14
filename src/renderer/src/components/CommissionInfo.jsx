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
      console.log("Updated Firestore Data:", newData); // Debugging log
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
      console.log("amount of users paid:", paidUsers.length); // Debugging log
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
      console.log("amount of users archived:", archiveUsers.length); // Debugging log
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

  // Triggered when user clicks button in context menu
  const handleContextMenuAction = (buttonId, userId) => {
    // Disable the button after the context menu action is selected
    setDisabledButtons((prev) => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [buttonId]: true, // Disable the button
      },
    }));
    updateEmailDatabase(buttonId, userId); // Update the database
  };

  // Updates Firestore doc of specific user
  const updateEmailDatabase = async (fieldName, userId) => {
    try {
      const documentRef = doc(db, "commissions", userId);
      await updateDoc(documentRef, {
        [fieldName]: true,
      });
      console.log("updated as true: " + fieldName);
    } catch (error) {
      console.error("Error toggling email:", error);
    }
  };

  const handleCloseMenu = () => {
    setMenuVisible(false);
  };

  // copy to clipboard information to paste into website
  const copyCarrdInfo = () => {
    var carrdArr = [];
    console.log(typeof userData);
    for (const id in userData) {
      const user = userData[id];
      if (user.ARCHIVE && !user.COMPLETE) {
        // if in archive and NOT complete, skip over
        continue;
      }
      const twitter = user.TWITTER;
      const noUnderscoreTwitter = twitter.replace(/[^a-zA-Z0-9\s]/g, "");

      // add due date if there is a due date
      // format information for website
      try {
        const commmDue = new Date(user.DUE.toDate());
        const dueDate = `${commmDue.getMonth() + 1}/${commmDue.getDate()}`;

        carrdArr.push(
          `♥ ${dueDate} ♥ ==${user.COMPLEX ? "★" : ""}${noUnderscoreTwitter}== `,
        );
        carrdArr.push(`${user.PAID ? " paid✔" : " pending ~"}`);
        carrdArr.push(`${id < 7 ? " ✎working⋆.ೃ࿔*:･" : ""}`);
        carrdArr.push(`${user.EMAIL_WIP ? " ✉" : ""}`);
        carrdArr.push(`${user.COMPLETE ? " ✉!!!" : ""}`);
        carrdArr.push(`\n`);
      } catch {
        carrdArr.push(`^${user.COMPLEX ? "★" : ""}${noUnderscoreTwitter} `);
        carrdArr.push(`${user.PAID ? " paid✔" : " pending ~"}`);
        carrdArr.push(`${user.EMAIL_PAY ? " ✉" : ""}`);
        carrdArr.push(`${user.EMAIL_COMP ? " ✉" : ""}`);
        carrdArr.push(`${user.EMAIL_COMPPAY ? " ✉" : ""}^`);
        carrdArr.push(`\n`);
      }
    }
    console.log(carrdArr.join(""));
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
