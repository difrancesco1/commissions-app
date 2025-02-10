import Home from "./components/Home.jsx"
import "../src/assets/base.css"
import { useEffect } from "react";

function App() {
  useEffect(() => {
    console.log("App is rendering");  // Confirm that the app is rendering
  }, []);

  return (
    <>
      <Home />
    </>
  )
}

export default App

