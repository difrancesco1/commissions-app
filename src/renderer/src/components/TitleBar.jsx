/* eslint-disable prettier/prettier */
import React from 'react'
import styles from './titleBar.module.css'
import icon from '../../../assets/rosieuna_icon.png'
import exit from '../../../assets/exit.png'

const TitleBar = () => {
  return (
    <div className={styles.titlebarContainer} >
        <img className={styles.icon} src={icon} alt="Rosieeuna icon" />
        <div className={styles.btns}>
            <img className={styles.exit} src={exit} alt="Rosieeuna icon"/>
        </div>
    </div>
  )
}

export default TitleBar