import './App.css';
import { createContext, useEffect, useReducer } from "react";
import Display from "./AppParts/Display";
import Keyboard from "./AppParts/Keyboard";
import GameOver from './AppParts/GameOver';
import Toast from './AppParts/Toast';
import { loadWordList } from './Words';
import { pickAnswer } from './gameLogic';
import { gameReducer, initialState } from './gameState';

// Provides { state, dispatch }; all game rules live in gameReducer.
export const AppContext = createContext(null);

function App() {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  useEffect(() => {
    let cancelled = false;
    loadWordList().then((words) => {
      if (!cancelled) dispatch({ type: "LOADED", words, answer: pickAnswer(words) });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Physical keyboard input. dispatch is stable, so this binds once.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "Enter") {
        dispatch({ type: "SUBMIT" });
      } else if (event.key === "Backspace") {
        dispatch({ type: "DELETE_LETTER" });
      } else if (/^[a-z]$/i.test(event.key)) {
        dispatch({ type: "ADD_LETTER", letter: event.key });
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const gameOver = state.status === "won" || state.status === "lost";

  return (
    <div className="App">
      <nav>
        <h1>Wordle</h1>
      </nav>
      <AppContext.Provider value={{ state, dispatch }}>
        <Toast />
        <div className="game">
          <Display />
          {gameOver ? <GameOver /> : <Keyboard />}
        </div>
      </AppContext.Provider>
    </div>
  );
}

export default App;
