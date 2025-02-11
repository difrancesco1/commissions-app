import Home from "./components/Home.jsx"
import "../src/assets/base.css"
import FooterBtn from './components/FooterBtn.jsx'
import TitleBar from "./components/TitleBar.jsx"

function App() {


  return (
    <div className="app-container">
      <TitleBar />
      <Home />
      <FooterBtn />
    </div>
  )
}

export default App

