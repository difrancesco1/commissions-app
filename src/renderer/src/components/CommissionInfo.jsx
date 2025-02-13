import React, { useState, useEffect, useMemo } from "react";
import styles from "./commissionInfo.module.css";
import CommissionInfoImg from "./CommissionInfoImg";

import { db } from "../firebaseConfig";
import { collection, orderBy, query, onSnapshot } from "firebase/firestore";
import CommissionInfoText from "./CommissionInfoText";

import btn1 from "../../../assets/btn1.png";
import btn2 from "../../../assets/btn2.png";
import btn3 from "../../../assets/btn3.png";
import btn4 from "../../../assets/btn4.png";
import btn5 from "../../../assets/btn5.png";

const CommissionInfo = ({ commissionIndex, searchQuery, listCount }) => {
  const [userData, setUserData] = useState([]);

  useEffect(() => {
    const q = query(
      collection(db, "commissions"),
      orderBy("ARCHIVE"),
      orderBy("PAID", "desc"),
      orderBy("DUE")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      console.log("Updated Firestore Data:", newData); // Debugging log
      setUserData(newData);
    });

    return () => unsubscribe();
  }, []);

  // Use useMemo to ensure selectedCommission updates correctly
  const selectedCommission = useMemo(() => {
    return userData.find((user, index) =>
      commissionIndex ? user.id === commissionIndex : index === 0
    );
  }, [userData, commissionIndex]);

  // right click handling
  const [menuVisible, setMenuVisible] = useState(false);

  const copyEmail = () => {
    // 14 - 66
    if (window.x >= 14 && window.x <= 66) {
      updateEmailDatabase("email_pay");
      disableEmailButton("btn1");
    }
    // 73 - 125
    else if (window.x >= 73 && window.x <= 125) {
      updateEmailDatabase("email_comp");
      disableEmailButton("btn2");
    }
    // 131 - 184
    else if (window.x >= 131 && window.x <= 184) {
      updateEmailDatabase("email_comppay");
      disableEmailButton("btn3");
    } else {
      updateEmailDatabase("email_pay");
      disableEmailButton("btn1");
      updateEmailDatabase("email_comp");
      disableEmailButton("btn2");
      updateEmailDatabase("email_comppay");
      disableEmailButton("btn3");
      // 190 - 242
      if (window.x >= 190 && window.x <= 242) {
        updateEmailDatabase("email_wip");
        disableEmailButton("btn4");
      }
      // 249 - 301
      else if (window.x >= 249 && window.x <= 301) {
        updateEmailDatabase("complete");
        updateEmailDatabase("archive");
        disableEmailButton("btn5");
      }
    }
  };

  // update database on email info and disable button
  const updateEmailDatabase = async (fieldName) => {
    try {
      const documentRef = doc(db, "commissions", user.id);
      await updateDoc(documentRef, {
        [fieldName]: true,
      });
      console.log("updated as true: " + fieldName);
    } catch (error) {
      console.error("Error toggling de email:", error);
    }
  };

  const disableEmailButton = (buttonId) => {
    let btn = document.getElementById(buttonId);
    btn.style.opacity = ".3";
  };

  const handleContextMenu = (event) => {
    event.preventDefault();
    let menu = document.getElementById("contextMenuEmailButton");
    menu.style.left = event.clientX + "px";
    menu.style.top = event.clientY + "px";
    window.x = event.clientX;
    setMenuVisible(true);
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

      <div className={styles.emailButtonContainer}>
        <div
          id="btn1"
          className={styles.emailBtn}
          onContextMenu={handleContextMenu}
        >
          <img
            className={styles.buttonText}
            src={btn1}
            alt="didntpayemailbutton"
          />
        </div>
        <div
          id="btn2"
          className={styles.emailBtn}
          onContextMenu={handleContextMenu}
        >
          <img
            className={styles.buttonText}
            src={btn2}
            alt="iscomplexemailbutton"
          />
        </div>
        <div
          id="btn3"
          className={styles.emailBtn}
          onContextMenu={handleContextMenu}
        >
          <img className={styles.buttonText} src={btn3} alt="bothemailbutton" />
        </div>
        <div
          id="btn4"
          className={styles.emailBtn}
          onContextMenu={handleContextMenu}
        >
          <img className={styles.buttonText} src={btn4} alt="wipemailbutton" />
        </div>
        <div
          id="btn5"
          className={styles.emailBtn}
          onContextMenu={handleContextMenu}
        >
          <img
            className={styles.buttonText}
            src={btn5}
            alt="finishedemailbutton"
          />
        </div>
      </div>
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
          ▾todo({listCount}/{userData.length})
        </div>
      </div>
    </div>
  );
};

export default CommissionInfo;
