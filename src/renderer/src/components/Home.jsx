import React, { useState, useEffect } from 'react'
import CardContainer from './CardContainer.jsx'
import styles from './home.module.css'
import CommissionInfo from './CommissionInfo.jsx'

const Home = () => {
    const [commissionIndex, setCommissionIndex] = useState(0);
    return (
        <div className={styles.container}>
            <CommissionInfo 
                commissionIndex={commissionIndex} 
                setCommissionIndex={setCommissionIndex}
            />
            
            <CardContainer 
                commissionIndex={commissionIndex} 
                setCommissionIndex={setCommissionIndex} 
            />
        </div>
    )
}

export default Home