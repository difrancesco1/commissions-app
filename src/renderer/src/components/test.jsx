import React, { useState } from "react";

function ContextMenu() {
  const [menuVisible, setMenuVisible] = useState(false);
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);

  const handleContextMenu = (event) => {
    event.preventDefault();
    setMouseX(event.clientX);
    setMouseY(event.clientY);
    setMenuVisible(true);
  };

  const handleCloseMenu = () => {
    setMenuVisible(false);
  };

  return (
    <div
      onContextMenu={handleContextMenu}
      style={{ border: "1px solid black", padding: "20px" }}
    >
      Right-click here to show context menu
      {menuVisible && (
        <div
          style={{
            position: "absolute",
            left: mouseX,
            top: mouseY,
            border: "1px solid gray",
            padding: "5px",
            backgroundColor: "white",
          }}
          onClick={handleCloseMenu}
          onMouseLeave={handleCloseMenu}
        >
          <ul>
            <li>Option 1</li>
            <li>Option 2</li>
            <li>Option 3</li>
          </ul>
        </div>
      )}
    </div>
  );
}

export default ContextMenu;
