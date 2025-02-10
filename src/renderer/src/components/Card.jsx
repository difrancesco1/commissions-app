import React from 'react'
import content from '../../../content.js'
import styles from './card.module.css'

const Card = () => {
    return (
        <div>
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