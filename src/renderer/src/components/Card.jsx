/* eslint-disable prettier/prettier */
import React from 'react'
import styles from './card.module.css'

const Card = ({user}) => {
    return (
        <div className={styles.cardContainer}>
            <div className={styles.card}>
                {/* <img 
                    className={styles.image}
                    src={user.image} 
                    alt={user.name}
                /> */}
            </div>
            <h1 className={styles.cardText}>{user.NAME}</h1>
        </div>
    )
}

export default Card
