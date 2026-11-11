import './App.css';
import { createContext, useEffect, useReducer, useState } from "react";
import Display from "./AppParts/Display";
import Keyboard from "./AppParts/Keyboard";
import GameOver from './AppParts/GameOver';
import Toast from './AppParts/Toast';
import { loadWordList } from './Words';
import { pickAnswer } from './gameLogic';
import { gameReducer, initialState } from './gameState';
import { readPreference, writePreference } from './storage';

// Provides { state, dispatch }; all game rules live in gameReducer.
export const AppContext = createContext(null);

function App() {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const [highContrast, setHighContrast] = useState(() => readPreference("highContrast", false));

  useEffect(() => {
    writePreference("highContrast", highContrast);
  }, [highContrast]);

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
        // Let a focused button (e.g. Play Again, a key reached with Tab)
        // handle its own Enter press.
        if (event.target.closest?.("button")) return;
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
    <div className="App" data-theme={highContrast ? "high-contrast" : undefined}>
      <header className="topBar">
        <div />
        <h1>Wordle</h1>
        <div className="topBarActions">
          <button
            type="button"
            className="iconButton"
            aria-label="High contrast colors"
            title="High contrast colors"
            aria-pressed={highContrast}
            // Don't keep focus after a mouse click, so Enter still submits.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setHighContrast((on) => !on)}
          >
            ◐
          </button>
        </div>
      </header>
      <AppContext.Provider value={{ state, dispatch }}>
        <Toast />
        <main className="game">
          <Display />
          {gameOver ? <GameOver /> : <Keyboard />}
        </main>
      </AppContext.Provider>
    </div>
  );
}

export default App;
