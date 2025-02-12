import React, { useState, useEffect } from "react";
import styles from "./commissionInfo.module.css";
import CommissionInfoImg from "./CommissionInfoImg";

import { db } from "../firebaseConfig";
import { collection, getDocs } from "firebase/firestore";
import CommissionInfoText from "./CommissionInfoText";

async function fetchDataFromFirestore() {
  const querySnapshot = await getDocs(collection(db, "commissions"));
  const data = [];
  querySnapshot.forEach((doc) => {
    data.push({ id: doc.id, ...doc.data() });
  });
  return data;
}

const CommissionInfo = ({ commissionIndex }) => {
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
        <div className={styles.emailBtn}>$</div>
        <div className={styles.emailBtn}>+</div>
        <div className={styles.emailBtn}>$+</div>
        <div className={styles.emailBtn}>✎</div>
        <div className={styles.emailBtn}>✿</div>
      </div>

      <div>
        {/* <div className={styles.todoCountText}>▾todo(5/20)</div> */}
        <div className={styles.todoCountText}>
          ▾todo(5/{userData.length})
        </div>

      </div>
    </div>
  );
};

export default CommissionInfo;
