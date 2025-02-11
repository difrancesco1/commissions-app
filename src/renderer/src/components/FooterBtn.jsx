/* eslint-disable prettier/prettier */
import React from 'react'
import styles from './footerBtn.module.css'

const FooterBtn = () => {
    const handleClick = () => {
        console.log("archive btn clicked");
    };

  return (
    <div className={styles.footerContainer} >
      <div className={styles.boxButton}>↺</div>

      <div className={styles.searchBar}>-.⊹˖ᯓ★. ݁₊</div>
      <div className={styles.rectangleButton}>↵</div>

      <div className={styles.boxButton}>●</div>
    </div>
  )
}

export default FooterBtn