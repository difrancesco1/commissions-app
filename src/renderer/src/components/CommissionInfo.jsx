/* eslint-disable prettier/prettier */
import React from 'react'
import styles from './commissionInfo.module.css'
import content from '../../../content.js'

const CommissionInfo = () => (
    <div className={styles.commissionInfo}>
        <div className={styles.clientInfo}>
            <div className={styles.imgStyle}></div>
            <div className={styles.clientText}>
                <p className={styles.nameText}>Lavana/Lana✩</p>
                <p className={styles.noteText}>add new face</p>
                <p className={styles.subText}>@Lavanai_</p>
                <p className={styles.subText}>cloudyyrachel@gmail.com</p>
                <p className={styles.subText}>paypal@gmail.com</p>
            </div>
            <div className={styles.dueInfo}>
                <p className={styles.subText}>2/10</p>
                <p className={styles.subText}>A02</p>
            </div>
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

export default CommissionInfo