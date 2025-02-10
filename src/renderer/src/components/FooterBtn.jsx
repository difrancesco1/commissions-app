import React from 'react'
import styles from './footerBtn.module.css'

const FooterBtn = () => {
    const handleClick = () => {
        console.log("archive btn clicked");
    
    };


  return (
    <div className={styles.button} onClick={handleClick}>
        <svg xmlns="http://www.w3.org/2000/svg" width="23" height="23" viewBox="0 0 24 24" style={{ fill: '#FFFFFF' }}>
        <path d="M 10 2 L 9 3 L 4 3 L 4 5 L 20 5 L 20 3 L 15 3 L 14 2 L 10 2 z M 5 7 L 5 20 C 5 21.1 5.9 22 7 22 L 17 22 C 18.1 22 19 21.1 19 20 L 19 7 L 5 7 z M 8 9 L 10 9 L 10 20 L 8 20 L 8 9 z M 14 9 L 16 9 L 16 20 L 14 20 L 14 9 z"></path>
      </svg>
    </div>
  )
}

export default FooterBtn