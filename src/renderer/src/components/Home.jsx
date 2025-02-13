import React, { useState, useEffect } from 'react'
import CardContainer from './CardContainer.jsx'
import styles from './home.module.css'
import CommissionInfo from './CommissionInfo.jsx'

const Home = ( { searchQuery } ) => {
    const [commissionIndex, setCommissionIndex] = useState(0);
    const [listCount, setListCount] = useState();
    return (
        <div className={styles.container}>
            <CommissionInfo 
                searchQuery={searchQuery}
                commissionIndex={commissionIndex} 
                setCommissionIndex={setCommissionIndex}
                listCount={listCount}
            />
            
            <CardContainer 
                searchQuery={searchQuery}
                commissionIndex={commissionIndex} 
                setCommissionIndex={setCommissionIndex} 
                setListCount={setListCount}
            />
        </div>
    )
}

export default Home