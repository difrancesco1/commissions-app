import React from 'react';
import styles from './CommissionInfo.module.css';


const CommissionInfoImg = ({ user }) => { // props
    return (
        <div className={`${styles.imgStyle}
            ${user.ARCHIVE === true ? styles.textArchive : null}
        `}>
            <img 
                src={user.IMG1} 
                alt="Commission Preview" 
                // className={styles.imgStyle} 
            />
        </div>
    );
}

export default CommissionInfoImg;
