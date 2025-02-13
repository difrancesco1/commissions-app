import React, { useState, useEffect } from "react";
import styles from "./commissionInfo.module.css";
import CommissionInfoImg from "./CommissionInfoImg";

import { db } from "../firebaseConfig";
import { collection, getDocs } from "firebase/firestore";
import CommissionInfoText from "./CommissionInfoText";

import btn1 from '../../../assets/btn1.png'
import btn2 from '../../../assets/btn2.png'
import btn3 from '../../../assets/btn3.png'
import btn4 from '../../../assets/btn4.png'
import btn5 from '../../../assets/btn5.png'

async function fetchDataFromFirestore() {
  const querySnapshot = await getDocs(collection(db, "commissions"));
  const data = [];
  querySnapshot.forEach((doc) => {
    data.push({ id: doc.id, ...doc.data() });
  });
  return data;
}

const CommissionInfo = ({ commissionIndex, searchQuery, listCount }) => {
  const [userData, setUserData] = useState([]);

  useEffect(() => {
    async function fetchData() {
      const data = await fetchDataFromFirestore();
      setUserData(data);
    }
    fetchData();
  }, []);
  

  // Default to first item if commissionIndex is not set
  const selectedCommission = userData.find((user, index) =>
    commissionIndex ? user.id === commissionIndex : index === 0 // on load starts at the first item on the list where index = 0
  );

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
            commissionIndex={commissionIndex} // filters by the passed commissionindex
            user={selectedCommission} 
          />
        )}
      </div>

      <div className={styles.clientInfo}>
        <div className={styles.emailBtn}>
          <img className={styles.buttonText} src={btn1} alt="didntpayemailbutton"/>
        </div>
        <div className={styles.emailBtn}>
          <img className={styles.buttonText} src={btn2} alt="iscomplexemailbutton"/>
        </div>
        <div className={styles.emailBtn}>
          <img className={styles.buttonText} src={btn3} alt="bothemailbutton"/>
        </div>
        <div className={styles.emailBtn}>
          <img className={styles.buttonText} src={btn4} alt="wipemailbutton"/>
        </div>
        <div className={styles.emailBtn}>
          <img className={styles.buttonText} src={btn5} alt="finishedemailbutton"/>
        </div>
      </div>

      <div>
        {/* <div className={styles.todoCountText}>▾todo(5/20)</div> */}
        <div className={styles.todoCountText}>
          ▾todo({listCount}/{userData.length})
        </div>

      </div>
    </div>
  );
};

export default CommissionInfo;
