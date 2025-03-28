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
  getDoc,
  setDoc,
} from "firebase/firestore";
import CommissionInfoText from "./CommissionInfoText";
import EmailButtonContainer from "./EmailButtonContainer";

const CommissionInfo = ({ commissionIndex, searchQuery, listCount }) => {
  const [userData, setUserData] = useState([]);
  const [paidUsers, setPaidUsers] = useState([]);
  const [archiveUsers, setArchiveUsers] = useState([]);
  const [disabledButtons, setDisabledButtons] = useState({});
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedButtonId, setSelectedButtonId] = useState(null);
  const [pastCommissionersData, setPastCommissionersData] = useState({});

  // Detailed button configuration
  const buttonConfig = {
    btn1: {
      fields: ["EMAIL_PAY", "EMAIL_COMP", "EMAIL_COMPPAY"],
      disableButtons: ["btn1", "btn2", "btn3"],
      complexRequired: false,
      additionalUpdate: { BTN1_CLICKED: true },
    },
    btn2: {
      fields: ["EMAIL_PAY", "EMAIL_COMP", "EMAIL_COMPPAY", "COMPLEX"],
      disableButtons: ["btn1", "btn2", "btn3"],
      complexRequired: false,
      additionalUpdate: { COMPLEX: true },
    },
    btn3: {
      fields: ["EMAIL_PAY", "EMAIL_COMP", "EMAIL_COMPPAY", "COMPLEX"],
      disableButtons: ["btn1", "btn2", "btn3"],
      complexRequired: false,
      additionalUpdate: { COMPLEX: true },
    },
    btn4: {
      fields: ["EMAIL_PAY", "EMAIL_COMP", "EMAIL_COMPPAY", "EMAIL_WIP"],
      disableButtons: ["btn1", "btn2", "btn3", "btn4"],
      complexRequired: false,
      additionalUpdate: {},
    },
    btn5: {
      fields: [
        "EMAIL_PAY",
        "EMAIL_COMP",
        "EMAIL_COMPPAY",
        "EMAIL_WIP",
        "COMPLETE",
        "ARCHIVE",
      ],
      disableButtons: ["btn1", "btn2", "btn3", "btn4", "btn5"],
      complexRequired: false,
      additionalUpdate: {},
    },
  };

  // Firestore data fetching
  useEffect(() => {
    // Fetch all commissions
    const commissionsQuery = query(
      collection(db, "commissions"),
      orderBy("ARCHIVE"),
      orderBy("PAID", "desc"),
      orderBy("DUE"),
    );

    const unsubscribeCommissions = onSnapshot(commissionsQuery, (snapshot) => {
      const newData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setUserData(newData);
    });

    // Fetch paid users
    const paidUsersQuery = query(
      collection(db, "commissions"),
      where("PAID", "==", true),
      where("ARCHIVE", "==", false),
    );

    const unsubscribePaidUsers = onSnapshot(paidUsersQuery, (snapshot) => {
      const paidUsers = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setPaidUsers(paidUsers);
    });

    // Fetch archived users
    const archivedUsersQuery = query(
      collection(db, "commissions"),
      where("ARCHIVE", "==", true),
    );

    const pastCommissionersQuery = query(collection(db, "pastCommissioners"));

    const unsubscribePastCommissioners = onSnapshot(
      // sets up a listener to watch for changes to the collection
      pastCommissionersQuery,
      (snapshot) => {
        const pastCommData = {}; // Holds the processed data
        snapshot.docs.forEach((doc) => {
          // iterates through each document in the 'snapshot'
          pastCommData[doc.id] = parseInt(doc.data().count) || 1; // twitter as the id, takes the count and converts the count to an int. Default to 1 if none
        });
        setPastCommissionersData(pastCommData); // updates components state (count -> commissioninfotext.jsx) triggering a re-render for the data
      },
    );

    const unsubscribeArchivedUsers = onSnapshot(
      archivedUsersQuery,
      (snapshot) => {
        const archiveUsers = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setArchiveUsers(archiveUsers);
      },
    );

    // Cleanup subscriptions
    return () => {
      unsubscribeCommissions();
      unsubscribePaidUsers();
      unsubscribeArchivedUsers();
      unsubscribePastCommissioners();
    };
  }, []);

  // Selected commission logic
  const selectedCommission = useMemo(() => {
    return userData.find((user, index) =>
      commissionIndex ? user.id === commissionIndex : index === 0,
    );
  }, [userData, commissionIndex]);

  // Selected commission logic for Archived database
  const selectedUserCommissionCount = useMemo(() => {
    // will only recalculate when selectedCommission or pastCommissionersData changes

    if (!selectedCommission || !selectedCommission.TWITTER) return 1; // for first render if the selectedCommission is undefined (will return 1 for the count)

    const twitterHandle = selectedCommission.TWITTER; // Extracts the twitter handle from the selected commission (from the commissions database)

    const pastCount = pastCommissionersData[twitterHandle]; // looks up the count in pastCommisionersData with the Twitter as a key

    return typeof pastCount === `number` ? Math.max(1, pastCount) : 1; // checks if pastColunt is a number, ensures it is at least 1, if not a number returns 1 as default
  }, [selectedCommission, pastCommissionersData]);

  // Get disabled buttons based on the commission data
  const getDisabledButtonsState = (commission) => {
    if (!commission) return {};

    const disabledState = {};

    // DIRECT CHECK FOR BUTTON 4 - If EMAIL_WIP is true, disable buttons 1-4
    if (commission.EMAIL_WIP === true) {
      disabledState.btn1 = true;
      disabledState.btn2 = true;
      disabledState.btn3 = true;
      disabledState.btn4 = true;
    }

    // DIRECT CHECK FOR BUTTON 5 - If COMPLETE and ARCHIVE are true, disable all buttons
    if (commission.COMPLETE === true && commission.ARCHIVE === true) {
      disabledState.btn1 = true;
      disabledState.btn2 = true;
      disabledState.btn3 = true;
      disabledState.btn4 = true;
      disabledState.btn5 = true;
    }

    // Process other button conditions using the configuration
    Object.keys(buttonConfig).forEach((btnKey) => {
      if (btnKey !== "btn4" && btnKey !== "btn5") {
        // Skip btn4 and btn5 as we handled them directly
        const config = buttonConfig[btnKey];

        // Check if all fields are true for this button
        const allFieldsTrue = config.fields.every(
          (field) => commission[field] === true,
        );

        // Complex requirement check
        const complexCheck = config.complexRequired ? commission.COMPLEX : true;

        // Additional checks for specific buttons
        const btn1Condition =
          btnKey !== "btn1"
            ? commission.BTN1_CLICKED || commission.COMPLEX
            : true;

        // If all conditions are met, disable the buttons according to config
        if (allFieldsTrue && complexCheck && btn1Condition) {
          config.disableButtons.forEach((disableBtn) => {
            disabledState[disableBtn] = true;
          });
        }
      }
    });

    return disabledState;
  };

  // Context menu handling
  const handleContextMenu = (event, buttonId, userId) => {
    event.preventDefault();
    let menu = document.getElementById("contextMenuEmailButton");
    menu.style.left = `${event.clientX}px`;
    menu.style.top = `${event.clientY}px`;
    window.x = event.clientX;
    setSelectedButtonId(buttonId);
    setMenuVisible(true);
  };

  // Update disabled buttons whenever selected commission changes
  useEffect(() => {
    if (selectedCommission) {
      const newDisabledState = getDisabledButtonsState(selectedCommission);
      setDisabledButtons(newDisabledState);
    }
  }, [selectedCommission]);

  // Context menu action handler
  const handleContextMenuAction = (buttonId, userId) => {
    const config = buttonConfig[buttonId];

    // Validate complex requirement if needed
    if (config.complexRequired && !selectedCommission.COMPLEX) {
      return;
    }

    // Update specified fields
    const updateData = {
      ...config.fields.reduce(
        (acc, field) => ({
          ...acc,
          [field]: true,
        }),
        {},
      ),
      ...config.additionalUpdate,
    };

    updateEmailDatabase(updateData, userId);
    handleCloseMenu();
  };

  // Database update function
  const updateEmailDatabase = async (updateData, userId) => {
    try {
      const documentRef = doc(db, "commissions", userId);
      await updateDoc(documentRef, updateData);
      console.log("Updated fields:", Object.keys(updateData));
    } catch (error) {
      console.error("Error updating email fields:", error);
    }
  };

  // Close context menu
  const handleCloseMenu = () => {
    setMenuVisible(false);
  };

  // copy to clipboard information to paste into website
  // also put items that are past pay due into archive
  const copyCarrdInfo = async () => {
    var carrdArr = [];
    for (const id in userData) {
      const user = userData[id];

      // dont touch blacklisted items
      if (user.NOTES.includes("AVOID:")) {
        continue;
      }

      // today's date + commission due date
      const todayDate = new Date();
      const commDue = new Date(user.PAYDUE.toDate());

      // if data is in archive, delete entry if commission is past paydate.
      // if deleted entry, no need to copy into carrd info
      if (user.ARCHIVE) {
        if (todayDate > commDue) {
          // if completed, add twitter to pastCommissioners database
          if (user.COMPLETE) {
            const docRef = doc(db, "pastCommissioners", user.TWITTER);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              const newCount = parseInt(docSnap.data()["count"]) + 1;
              await updateDoc(docRef, {
                count: newCount,
              });
            } else {
              await setDoc(docRef, {
                count: 1,
              });
              console.log("added " + user.TWITTER + " to pastCommissioners.");
            }
            console.log("deleted " + user.TWITTER + " from database.");
          }
          // delete commission
          await deleteDoc(doc(db, "commissions", user.ID));
        }
        continue;
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
          continue;
        }
      }
      // put into carrd array to be copied
      if (!user.COMPLETE) {
        // clean twitter name to not have any symbols
        const twitter = user.TWITTER;
        const noUnderscoreTwitter = twitter.replace(/[^a-zA-Z0-9\s]/g, "");

        // add due date if there is a due date
        // format information for website
        try {
          const commmDue = new Date(user.DUE.toDate());
          const dueDate = `${commmDue.getMonth() + 1}.${commmDue.getDate()}`;

          carrdArr.push(
            `✿${dueDate}➮ ==${user.COMPLEX ? "★" : ""}${noUnderscoreTwitter}==`,
          );
          carrdArr.push(`${user.EMAIL_WIP ? " ✎art done.ೃ࿔:･" : ".ೃ࿔:･"}`);
          carrdArr.push(`\n`);
        } catch {
          carrdArr.push(`^${user.COMPLEX ? "★" : ""}${noUnderscoreTwitter} `);
          carrdArr.push(`${user.PAID ? "💰" : " pending ~"}`);
          carrdArr.push(
            `${user.EMAIL_PAY || user.EMAIL_COMP || user.EMAIL_COMPPAY ? " 💌" : ""}^`,
          );
          carrdArr.push(`\n`);
        }
      }
    }
    // copy website information to clipboard
    navigator.clipboard.writeText(carrdArr.join(""));
  };

  return (
    <div className={styles.commissionInfo}>
      <div className={styles.clientInfo}>
        {selectedCommission && selectedUserCommissionCount && (
          <>
            <CommissionInfoImg
              commissionIndex={commissionIndex}
              user={selectedCommission}
            />
            <CommissionInfoText
              commissionIndex={commissionIndex}
              user={selectedCommission}
              count={selectedUserCommissionCount}
            />
          </>
        )}
      </div>

      {/* Email Buttons container */}
      {selectedCommission && (
        <EmailButtonContainer
          userId={selectedCommission.id}
          user={selectedCommission}
          onContextMenuHandler={handleContextMenu}
          disabledButtons={disabledButtons}
          handleContextMenuAction={handleContextMenuAction}
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
