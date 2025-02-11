import React from 'react'
import CardContainer from './CardContainer.jsx'
import styles from './home.module.css'
import CommissionInfo from './CommissionInfo.jsx'

const Home = () => {

    return (
        <div className={styles.container}>
            <CommissionInfo />
            <CardContainer />
        </div>
    )
}

export default Home