import './App.css';
import { createContext, useEffect, useReducer, useRef, useState } from "react";
import Display from "./AppParts/Display";
import Keyboard from "./AppParts/Keyboard";
import GameOver from './AppParts/GameOver';
import Toast from './AppParts/Toast';
import HelpModal from './AppParts/HelpModal';
import SettingsModal from './AppParts/SettingsModal';
import { SettingsIcon } from './AppParts/Icons';
import { loadWordList } from './Words';
import { getAnswerPool, pickAnswer } from './gameLogic';
import { canChangeHardMode, gameReducer, initialState } from './gameState';
import { readPreference, writePreference } from './storage';

// Provides { state, dispatch }; all game rules live in gameReducer.
export const AppContext = createContext(null);

function App() {
  const [state, dispatch] = useReducer(gameReducer, initialState, (s) => ({
    ...s,
    hardMode: readPreference("hardMode", false),
  }));
  const [theme, setTheme] = useState(() => readPreference("theme", systemTheme()));
  const [highContrast, setHighContrast] = useState(() => readPreference("highContrast", false));

  // Which dialog is open: "help" | "settings" | null. The rules open
  // automatically on a player's first visit.
  const [modal, setModal] = useState(() => (readPreference("seenHelp", false) ? null : "help"));
  const modalRef = useRef(modal);
  modalRef.current = modal;

  // Themes are applied to <html> so the page background follows too.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    if (highContrast) root.dataset.palette = "high-contrast";
    else delete root.dataset.palette;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "light" ? "#ffffff" : "#121212");
    writePreference("theme", theme);
    writePreference("highContrast", highContrast);
  }, [theme, highContrast]);

  useEffect(() => {
    writePreference("hardMode", state.hardMode);
  }, [state.hardMode]);

  const closeModal = () => {
    if (modal === "help") writePreference("seenHelp", true);
    setModal(null);
  };

  useEffect(() => {
    let cancelled = false;
    loadWordList().then((words) => {
      if (cancelled) return;
      const answers = getAnswerPool(words);
      dispatch({ type: "LOADED", words, answers, answer: pickAnswer(answers) });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Physical keyboard input. dispatch is stable, so this binds once.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      // Typing goes nowhere while a dialog is open.
      if (modalRef.current) return;
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

  const hardModeLocked = !canChangeHardMode(state);
  const settings = [
    {
      id: "hard-mode",
      label: "Hard mode",
      description: hardModeLocked
        ? "Can only be changed at the start of a round"
        : "Any revealed hints must be used in later guesses",
      checked: state.hardMode,
      disabled: hardModeLocked,
      onChange: (on) => dispatch({ type: "SET_HARD_MODE", on }),
    },
    {
      id: "light-theme",
      label: "Light theme",
      checked: theme === "light",
      onChange: (on) => setTheme(on ? "light" : "dark"),
    },
    {
      id: "high-contrast",
      label: "Color-blind colors",
      description: "Orange and blue instead of green and yellow",
      checked: highContrast,
      onChange: setHighContrast,
    },
  ];

  return (
    <div className="App">
      <header className="topBar">
        <div className="topBarActions start">
          <HeaderButton label="How to play" onClick={() => setModal("help")}>
            ?
          </HeaderButton>
        </div>
        <h1>Wordle</h1>
        <div className="topBarActions">
          <HeaderButton label="Settings" onClick={() => setModal("settings")}>
            <SettingsIcon />
          </HeaderButton>
        </div>
      </header>
      <AppContext.Provider value={{ state, dispatch }}>
        <Toast />
        <main className="game">
          <Display />
          {gameOver ? <GameOver /> : <Keyboard />}
        </main>
      </AppContext.Provider>
      {modal === "help" && <HelpModal onClose={closeModal} />}
      {modal === "settings" && <SettingsModal settings={settings} onClose={closeModal} />}
    </div>
  );
}

function HeaderButton({ label, onClick, children }) {
  return (
    <button
      type="button"
      className="iconButton"
      aria-label={label}
      title={label}
      // Don't keep focus after a mouse click, so Enter still submits.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function systemTheme() {
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export default App;
