import React from 'react'
import styles from './card.module.css'

const Card = ({content}) => {
    return (
        <div className={styles.card}>
            {content.map((item) => {
                return (
                    <div key={item.key}>
                        <img 
                            className={styles.image}
                            src={item.image} alt="Content" />
                    </div>
                )
            })}
        </div>
    )
}

export default Card