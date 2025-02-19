import React, { useState, useEffect } from "react";
import styles from "./commissionInfo.module.css";
import btn1 from "../../../assets/btn1.png";
import btn2 from "../../../assets/btn2.png";
import btn3 from "../../../assets/btn3.png";
import btn4 from "../../../assets/btn4.png";
import btn5 from "../../../assets/btn5.png";
import { db } from "../firebaseConfig";
import { collection, getDocs } from "firebase/firestore";

const EmailButtonContainer = ({
  user,
  userId,
  onContextMenuHandler,
  disabledButtons,
  handleContextMenuAction,
}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const getButtonStyle = (buttonId) => {
    return disabledButtons?.[buttonId]
      ? { opacity: 0.3, pointerEvents: "none" }
      : {};
  };

  const templates = {
    btn1: `♡ ${user.COMM_NAME} followup ♡\n\nhello ${user.NAME.toLowerCase()}!!\n\nwe received your form for our ${user.COMM_NAME} but we can't find your paypal payment. if you still want to commission us, please pay with the link below, and note your twitter in the payment! if you already paid us, we are so sorry for missing your payment. let us know your paypal email so we can look it up in the search~\n\nhttps://www.paypal.com/biz/profile/eunamiku\nthank you!\n🎀rosie + euna🎀`,
    btn2: `♡ ${user.COMM_NAME} commission fee ♡\n\nhello ${user.NAME.toLowerCase()}!!\n\nwe took a closer look at your reference, and unfortunately the design will be complex to draw, as well as to animate. if this is okay with you, please send the complex fee (noted in our website) to our paypal with this link!\n\nhttps://www.paypal.com/biz/profile/eunamiku\nwe hope you have a wonderful day~\n🎀rosie + euna🎀`,
    btn3: `♡ ${user.COMM_NAME} followup ♡\n\nhello ${user.NAME.toLowerCase()}!!\n\nwe received your form for our ${user.COMM_NAME} but we can't find your paypal payment. did you still want to commission us? we also took a closer look at your reference, and unfortunately the design will be complex to draw, as well as to animate. if you're still interested, please pay the complex fee (noted in our website) to our paypal with this link! \n\nhttps://www.paypal.com/biz/profile/eunamiku\nthank you ~!\n🎀rosie + euna🎀`,
    btn4: ` `,
    btn5: `❣ your ${user.COMM_NAME} is finished! ❣\n\nhello ${user.NAME.toLowerCase()}!!\n\nthank you for your support on the ${user.COMM_NAME} <3 we've provided the full art size, and a smaller size for twitch/discord ~\n\nwe hope you enjoy your commission♡✧~\nhave a wonderful day!\n🎀rosie + euna🎀`,
  };

  // Function to handle button click
  const handleButtonClick = async (buttonId) => {
    const templateText = templates[buttonId];
    if (templateText) {
      try {
        // Copy the template text to the clipboard
        await navigator.clipboard.writeText(templateText);
        console.log(`Copied template for ${buttonId}:`, templateText);
      } catch (err) {
        console.error("Failed to copy: ", err);
      }
    }
  };

  // Fetch data from Firestore
  const fetchDataFromFirestore = async () => {
    const sectionsCollectionRef = collection(db, "commissions");
    const querySnapshot = await getDocs(sectionsCollectionRef);
    const data = [];
    querySnapshot.forEach((doc) => {
      data.push({ id: doc.id, ...doc.data() });
    });
    return data;
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const newData = await fetchDataFromFirestore();
        setData(newData);
      } catch (error) {
        console.error("Error fetching data from Firestore:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className={styles.emailButtonContainer}>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <>
          <div
            id={`btn1-${userId}`}
            className={styles.emailBtn}
            onContextMenu={(e) => onContextMenuHandler(e, "btn1", userId)}
            onClick={() => handleButtonClick("btn1")}
            style={getButtonStyle("btn1")}
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
            onContextMenu={(e) => onContextMenuHandler(e, "btn2", userId)}
            onClick={() => handleButtonClick("btn2")}
            style={getButtonStyle("btn2")}
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
            onContextMenu={(e) => onContextMenuHandler(e, "btn3", userId)}
            onClick={() => handleButtonClick("btn3")}
            style={getButtonStyle("btn3")}
          >
            <img
              className={styles.buttonText}
              src={btn3}
              alt="bothemailbutton"
            />
          </div>
          <div
            id={`btn4-${userId}`}
            className={styles.emailBtn}
            onContextMenu={(e) => onContextMenuHandler(e, "btn4", userId)}
            onClick={() => handleButtonClick("btn4")}
            style={getButtonStyle("btn4")}
          >
            <img
              className={styles.buttonText}
              src={btn4}
              alt="wipemailbutton"
            />
          </div>
          <div
            id={`btn5-${userId}`}
            className={styles.emailBtn}
            onContextMenu={(e) => onContextMenuHandler(e, "btn5", userId)}
            onClick={() => handleButtonClick("btn5")}
            style={getButtonStyle("btn5")}
          >
            <img
              className={styles.buttonText}
              src={btn5}
              alt="finishedemailbutton"
            />
          </div>
        </>
      )}
    </div>
  );
};

export default EmailButtonContainer;
