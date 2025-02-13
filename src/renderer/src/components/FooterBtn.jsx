import React, { useState } from 'react';
import styles from './footerBtn.module.css';
import refreshgmail from '../../../assets/refreshgmail.png'
import search from '../../../assets/search.png'
import copytocarrd from '../../../assets/copytocarrd.png'

const FooterBtn = ({ setSearchQuery }) => {
    const [query, setQuery] = useState(""); // Local state for the search query

    // Handle input change and update the parent component
    const handleChange = (e) => {
        setQuery(e.target.value); // Update local state
        setSearchQuery(e.target.value); // Pass the query to the parent component
    };


  return (
    <div className={styles.footerContainer} >
      <div className={styles.boxButton}>
        <img className={styles.buttonText} src={refreshgmail} alt="refreshgmail button"/>
      </div>

      <input 
        type="text" 
        placeholder="-.⊹˖ᯓ★. ݁₊" 
        className={styles.searchBar} 
        value={query} // Bind input value to local state
        onChange={handleChange} // Call handleChange on input change
      />
      <div className={styles.rectangleButton}>
        <img className={styles.buttonText} src={search} alt="search button"/>
      </div>

      <div className={styles.boxButton}>
        <img className={styles.buttonText} src={copytocarrd} alt="copytocarrd button"/>
      </div>
    </div>
    );
};

export default FooterBtn;
