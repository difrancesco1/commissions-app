import React, { useState } from 'react';
import styles from './footerBtn.module.css';

const FooterBtn = ({ setSearchQuery }) => {
    const [query, setQuery] = useState(""); // Local state for the search query

    // Handle input change and update the parent component
    const handleChange = (e) => {
        setQuery(e.target.value); // Update local state
        setSearchQuery(e.target.value); // Pass the query to the parent component
    };

    return (
        <div className={styles.footerContainer}>
            <div className={styles.boxButton}>↺</div>

            <input 
                type="text" 
                placeholder="-.⊹˖ᯓ★. ݁₊" 
                className={styles.searchBar} 
                value={query} // Bind input value to local state
                onChange={handleChange} // Call handleChange on input change
            />

            <div className={styles.rectangleButton}>↵</div>

            <div className={styles.boxButton}>●</div>
        </div>
    );
};

export default FooterBtn;
