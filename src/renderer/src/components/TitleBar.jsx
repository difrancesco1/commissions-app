/* eslint-disable prettier/prettier */
import React from "react";
import styles from "./titleBar.module.css";
import exit from "../../../assets/exit.png";
const { ipcRenderer } = window.require("electron");

const TitleBar = () => {
  const handleClose = () => {
    ipcRenderer.send("app-close");
  };
  return (
    <div className={styles.titlebarContainer}>
      <p className={styles.draggableTitleBar}>✿ ROSIEUNA ˚˖ ࣪ </p>
      <div
        className={styles.btns}
        onClick={handleClose}
        style={{ "pointer-events": "all" }}
      >
        <img className={styles.exit} src={exit} alt="exit button" />
      </div>
    </div>
  );
};

export default TitleBar;
