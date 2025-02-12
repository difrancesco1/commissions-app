/* eslint-disable prettier/prettier */
import React from 'react'
import styles from './footerBtn.module.css'
import refreshgmail from '../../../assets/refreshgmail.png'
import search from '../../../assets/search.png'
import copytocarrd from '../../../assets/copytocarrd.png'

const FooterBtn = () => {
    const handleClick = () => {
        console.log("archive btn clicked");
    };

  return (
    <div className={styles.footerContainer} >
      <div className={styles.boxButton}>
        <img className={styles.buttonText} src={refreshgmail} alt="refreshgmail button"/>
      </div>

      <div className={styles.searchBar}>-.⊹˖ᯓ★. ݁₊</div>
      <div className={styles.rectangleButton}>
        <img className={styles.buttonText} src={search} alt="search button"/>
      </div>

      <div className={styles.boxButton}>
        <img className={styles.buttonText} src={copytocarrd} alt="copytocarrd button"/>
      </div>
    </div>
  )
}

export default FooterBtn