// EmailButtonContainer.jsx
import React from "react";
import styles from "./commissionInfo.module.css";
import btn1 from "../../../assets/btn1.png";
import btn2 from "../../../assets/btn2.png";
import btn3 from "../../../assets/btn3.png";
import btn4 from "../../../assets/btn4.png";
import btn5 from "../../../assets/btn5.png";

const EmailButtonContainer = ({ userId, onContextMenuHandler }) => {
  const handleButtonClick = (event, buttonId) => {
    event.preventDefault();
    onContextMenuHandler(event, buttonId, userId);
  };

  return (
    <div className={styles.emailButtonContainer}>
      <div
        id={`btn1-${userId}`}
        className={styles.emailBtn}
        onContextMenu={(e) => handleButtonClick(e, "btn1")}
      >
        <img
          className={styles.buttonText}
          src={btn1}
          alt="didntpayemailbutton"
        />
      </div>
      <div
        id={`btn2-${userId}`}
        className={styles.emailBtn}
        onContextMenu={(e) => handleButtonClick(e, "btn2")}
      >
        <img
          className={styles.buttonText}
          src={btn2}
          alt="iscomplexemailbutton"
        />
      </div>
      <div
        id={`btn3-${userId}`}
        className={styles.emailBtn}
        onContextMenu={(e) => handleButtonClick(e, "btn3")}
      >
        <img className={styles.buttonText} src={btn3} alt="bothemailbutton" />
      </div>
      <div
        id={`btn4-${userId}`}
        className={styles.emailBtn}
        onContextMenu={(e) => handleButtonClick(e, "btn4")}
      >
        <img className={styles.buttonText} src={btn4} alt="wipemailbutton" />
      </div>
      <div
        id={`btn5-${userId}`}
        className={styles.emailBtn}
        onContextMenu={(e) => handleButtonClick(e, "btn5")}
      >
        <img
          className={styles.buttonText}
          src={btn5}
          alt="finishedemailbutton"
        />
      </div>
    </div>
  );
};

export default EmailButtonContainer;
