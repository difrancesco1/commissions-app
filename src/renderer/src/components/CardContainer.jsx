import React from 'react'
import Card from './Card.jsx'
import styles from './cardContainer.module.css'
import content from '../../../content.js'

const CardContainer = () => {
    return (
        <div className={styles.container}>
            <Card content={content} />
        </div>
    )
}

export default CardContainer