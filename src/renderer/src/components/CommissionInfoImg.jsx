import React, { useState, useEffect } from "react";
import styles from "./CommissionInfo.module.css";
import loading from "../../../assets/loading.gif";  

const CommissionInfoImg = ({ user }) => {
  const [imageExists, setImageExists] = useState(false);
  // Full URL to the image from the backend API
  const imagePath = `http://localhost:5000/API/images/${user.ID}.png`;  

  const loadImage = async () => {
    try {
      const imageCheck = await fetch(imagePath);
      if (imageCheck.ok) {
        setImageExists(true);
      } else {
        setImageExists(false);
      }
    } catch (error) {
      setImageExists(false);
    }
  };

  useEffect(() => {
    loadImage();
  }, [user.ID]);

  return (
    <div
      className={`${imageExists ? styles.imgStyle : styles.loadingCardStyle} 
        ${user.ARCHIVE ? styles.textArchive : ""}`}
    >
      <img
        className={imageExists ? styles.commissionImageStyle : styles.loadingStyle}
        src={imageExists ? imagePath : loading}
        alt="Commission Preview"
      />
    </div>
  );
};

export default CommissionInfoImg;
