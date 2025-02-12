import React, { useState, useEffect } from 'react';
import styles from './CommissionInfo.module.css'

function CommissionInfoText( {user, commissionIndex, setCommissionIndex } ) {
  return (
    <>
        <div className={styles.clientText}>
          <p className={styles.nameText}>{user.NAME}</p>
          <p className={styles.noteText}>{user.NOTES}</p>
          <p className={styles.subText}>{user.TWITTER}</p>
          <p className={styles.subText}>{user.EMAIL}</p>
          <p className={styles.subText}>{user.PAYPAL}</p>
        </div>
        <div className={styles.dueInfo}>
          <p className={styles.subText}>2/10</p>
          <p className={styles.subText}>{user.COMM_TYPE}</p>
        </div>
    </>
  )
}

export default CommissionInfoText