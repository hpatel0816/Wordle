import './App.css';
import Display from "./AppParts/Display";
import Keyboard from "./AppParts/Keyboard";
import {createContext, useState} from "react";
import { displayDefault } from './Words';


export const AppContext = createContext();

function App() {
  const [display, setDisplay] = useState(displayDefault);
  const [currAttempt, setCurrAttempt] = useState({attempt: 0, letterPos: 0})
  
  const onSelectLetter = (keyVal) => {
    if (currAttempt.letterPos > 4) return;
    const newDisplay = [...display];
    newDisplay[currAttempt.attempt][currAttempt.letterPos] = keyVal;
    setDisplay(newDisplay);
    setCurrAttempt({...currAttempt, letterPos: currAttempt.letterPos + 1});
  }

  const onDelete = () => {
    if (currAttempt.letterPos === 0) return;
    const newDisplay = [...display];
    newDisplay[currAttempt.attempt][currAttempt.letterPos -1] = "";
    setDisplay(newDisplay)
    setCurrAttempt({...currAttempt, letterPos: currAttempt.letterPos - 1})

  }

  const onEnter = () => {
    if (currAttempt.letterPos !== 5) return;
    setCurrAttempt({attempt: currAttempt.attempt + 1, letterPos: 0})
  }

  return (
    <div className="App">
      <nav>
        <h1>Wordle</h1>
      </nav>
      <AppContext.Provider 
        value={{display, setDisplay, currAttempt, setCurrAttempt, onSelectLetter, onDelete, onEnter}}
      >
        <div className = "game">
          <Display />
          <Keyboard />
        </div>
      </AppContext.Provider>
    </div>
  );
}

export default App;
