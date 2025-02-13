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

  const handleContextMenu = (event) => {
    event.preventDefault();
    let menu = document.getElementById("contextMenuEmailButton");
    menu.style.left = event.clientX + "px";
    menu.style.top = event.clientY + "px";
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
        <div className={styles.emailBtn} onContextMenu={handleContextMenu}>
          <img
            className={styles.buttonText}
            src={btn1}
            alt="didntpayemailbutton"
          />
        </div>
        <div className={styles.emailBtn} onContextMenu={handleContextMenu}>
          <img
            className={styles.buttonText}
            src={btn2}
            alt="iscomplexemailbutton"
          />
        </div>
        <div className={styles.emailBtn} onContextMenu={handleContextMenu}>
          <img className={styles.buttonText} src={btn3} alt="bothemailbutton" />
        </div>
        <div className={styles.emailBtn} onContextMenu={handleContextMenu}>
          <img className={styles.buttonText} src={btn4} alt="wipemailbutton" />
        </div>
        <div className={styles.emailBtn} onContextMenu={handleContextMenu}>
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
              <li className={styles.item}>✉</li>
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
