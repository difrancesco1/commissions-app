import React from 'react'
import CardContainer from './CardContainer.jsx'
import styles from './home.module.css'

const Home = () => {

    return (
        <div className={styles.container}>
            <CardContainer />
        </div>
    )
}

export default Home