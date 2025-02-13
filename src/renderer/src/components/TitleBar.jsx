/* eslint-disable prettier/prettier */
import React from 'react'
import styles from './titleBar.module.css'
import exit from '../../../assets/exit.png'

const TitleBar = () => {
  return (
    <div className={styles.titlebarContainer} >
        <p className={styles.text}>✿ ROSIEUNA ˚˖ ࣪ </p>
        <div className={styles.btns}>
            <img className={styles.exit} src={exit} alt="exit button"/>
        </div>
    </div>
  )
}

export default TitleBar