/* eslint-disable prettier/prettier */
import React from 'react'
import styles from './card.module.css'

const Card = ({item}) => {
    return (
        <div className={styles.card}>
            <img 
                className={styles.image}
                src={item.image} 
                alt={item.name}
            />
            <p>test</p>
        </div>
    )
}

export default Card