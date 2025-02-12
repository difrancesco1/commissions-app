import React, { useState, useEffect } from 'react';
import styles from './commissionInfo.module.css'

import { db } from "../firebaseConfig"; // Import Firestore
import { collection, getDocs } from "firebase/firestore";
import CommissionInfoText from './CommissionInfoText';


async function fetchDataFromFirestore() {
    const querySnapshot = await getDocs(collection(db, "commissions"))
  
    const data = [];
    querySnapshot.forEach((doc) => {
      data.push({ id: doc.id, ...doc.data()})
    });
    return data;
  }

const CommissionInfo = ( { commissionIndex, setCommissionIndex } ) => {

  const [userData, setUserData] = useState([]);

  useEffect(() => {
    async function fetchData() {
      const data = await fetchDataFromFirestore();
      setUserData(data);
      
    }
    fetchData();
  }, []);
    return (
        
    <div className={styles.commissionInfo}> 
        <div className={styles.clientInfo}>

          <div className={styles.imgStyle}></div>

          {userData
            .filter((_, index) => index === 0)  // Only include the first item
            .map((user, index) => (
              <CommissionInfoText 
                commissionIndex={commissionIndex}
                setCommissionIndex={setCommissionIndex}
                key={user.id} 
                user={user}
              />
          ))}


        </div>

        <div className={styles.clientInfo}>
            <div className={styles.emailBtn}>$</div>
            <div className={styles.emailBtn}>+</div>
            <div className={styles.emailBtn}>$+</div>
            <div className={styles.emailBtn}>✎</div>
            <div className={styles.emailBtn}>✿</div>
        </div>
        <div>
            <div className={styles.todoCountText}>▾todo(5/20)</div>
        </div>
    </div>
   
)
}

export default CommissionInfo