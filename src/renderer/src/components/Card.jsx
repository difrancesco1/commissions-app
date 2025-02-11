/* eslint-disable prettier/prettier */
import React from 'react'
import styles from './card.module.css'

const Card = ({item}) => {
    return (
        <div className={styles.cardContainer}>
            <div className={styles.card}>
                <img 
                    className={styles.image}
                    src={item.image} 
                    alt={item.name}
                />
            </div>
            <h1 className={styles.cardText}>{item.twitter}</h1>
        </div>
    )
}

export default Card
