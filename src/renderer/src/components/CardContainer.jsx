import React from 'react'
import Card from './Card.jsx'
import styles from './cardContainer.module.css'
import content from '../../../content.js'

import { db } from "../firebaseConfig"; // Import Firestore
import { collection, getDocs } from "firebase/firestore";

const CardContainer = () => {
  return (
    <>
      <div className={styles.container}>
        {content.map((item) => (
          <Card key={item.key} item={item} />
        ))}
      </div>
    </>
  )
}

export default CardContainer
