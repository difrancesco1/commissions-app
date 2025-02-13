import React from "react";
import styles from "./CommissionInfo.module.css";
import loading from "../../../assets/loading.gif";

const CommissionInfoImg = ({ user }) => {
  // props
  // TODO: CHANGE THIS TO ACTUALLY BE LOGICAL ^_^
  const imageExists = false;
  return (
    <div
      className={`${imageExists === true ? styles.imgStyle : styles.loadingCardStyle}
            ${user.ARCHIVE === true ? styles.textArchive : null}
        `}
    >
      <img
        className={`${imageExists === true ? null : styles.loadingStyle}`}
        src={`${imageExists === true ? user.IMG1 : loading}`} // TODO: CHANGE USER.IMG1
        alt="Commission Preview"
        // className={styles.imgStyle}
      />
    </div>
  );
};

export default CommissionInfoImg;
