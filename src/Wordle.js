import './Wordle.css';
import Display from "./components/Display";
import Keyboard from "./components/Keyboard";
import {createContext, useEffect, useState} from "react";
import { displayDefault, generateWordSet } from './Words';
import GameOver from './components/GameOver';


export const AppContext = createContext();

function Wordle() {
  const [display, setDisplay] = useState(displayDefault);
  const [currAttempt, setCurrAttempt] = useState({attempt: 0, letterPos: 0})
  const [wordSet, setWordSet] = useState(new Set());
  const[disabledLetters, setDisabledLetter] = useState([]);
  const [correctWord, setCorrectWord] = useState("")
  const [gameOver, setGameOver] = useState({gameOver: false, guessedWord: false});

  useEffect(() => {
    generateWordSet().then((words) => {
      setWordSet(words.wordSet);
      setCorrectWord(words.todaysWord);
    });
  }, []);

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

    let currWord = "";
    for (let i =  0; i < 5; i++) {
      currWord += display[currAttempt.attempt][i];
    }
    console.log(currWord)
    if (wordSet.has(currWord.toLowerCase())) {
      setCurrAttempt({attempt: currAttempt.attempt + 1, letterPos: 0});
    } else {
      alert("Word Not Found");
    }

    if (currWord === correctWord) {
      setGameOver({gameOver: true, guessedWord: true});
      return;
    }

    if (currAttempt.attempt === 5) {
      setGameOver({gameOver: true, guessedWord : false});
    }
  };

  return (
    <div className="App">
      <nav>
        <h1>Wordle</h1>
      </nav>
      <AppContext.Provider 
        value={{
          display,
          setDisplay,
          currAttempt,
          setCurrAttempt,
          onSelectLetter,
          onDelete,
          onEnter,
          correctWord,
          setDisabledLetter,
          disabledLetters,
          gameOver,
          setGameOver
        }}
      >
        <div className = "game">
          <Display />
          {gameOver.gameOver ? <GameOver /> : <Keyboard />}
        </div>
      </AppContext.Provider>
    </div>
  );
}

export default Wordle;
