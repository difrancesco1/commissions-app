import React, { useState } from "react";
import Home from "./components/Home.jsx";
import FooterBtn from "./components/FooterBtn.jsx";
import TitleBar from "./components/TitleBar.jsx";
import "../src/assets/base.css";

function App() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="app-container">
      <TitleBar />
      <Home searchQuery={searchQuery} />
      <FooterBtn setSearchQuery={setSearchQuery} />
    </div>
  );
}

export default App;
