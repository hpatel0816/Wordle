import './App.css';
import { createContext, useCallback, useEffect, useReducer, useRef, useState } from "react";
import Display from "./AppParts/Display";
import Keyboard from "./AppParts/Keyboard";
import GameOver from './AppParts/GameOver';
import Toast from './AppParts/Toast';
import HelpModal from './AppParts/HelpModal';
import SettingsModal from './AppParts/SettingsModal';
import StatsModal from './AppParts/StatsModal';
import ChallengeModal from './AppParts/ChallengeModal';
import { SettingsIcon, StatsIcon } from './AppParts/Icons';
import { loadStats, recordResult, saveStats } from './stats';
import { loadWordList } from './Words';
import { CHALLENGE_PARAM, decodeChallenge, getAnswerPool, getDayNumber } from './gameLogic';
import { canChangeHardMode, gameReducer, initialState } from './gameState';
import { readPreference, writePreference } from './storage';
import { roundFor, saveGame } from './savedGames';
import ModeSwitch from './AppParts/ModeSwitch';

// Provides { state, dispatch, startRound, openModal, display }; all game
// rules live in gameReducer.
export const AppContext = createContext(null);

function App() {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const [theme, setTheme] = useState(() => readPreference("theme", systemTheme()));
  const [highContrast, setHighContrast] = useState(() => readPreference("highContrast", false));

  // Which dialog is open: "help" | "settings" | "stats" | "challenge" | null. The rules open
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

  // The hard mode setting for new rounds. The current round keeps the
  // setting it started with (state.hardMode).
  const [hardModePref, setHardModePref] = useState(() => readPreference("hardMode", false));
  const hardModeRef = useRef(hardModePref);
  hardModeRef.current = hardModePref;
  const answersRef = useRef(state.answers);
  answersRef.current = state.answers;

  // Start (or resume) a round in "daily" or "unlimited" mode.
  const startRound = useCallback((mode) => {
    clearChallengeFromUrl();
    writePreference("mode", mode);
    dispatch({ type: "START", ...roundFor(mode, answersRef.current, hardModeRef.current) });
  }, []);

  // Settings only calls this while the switch is unlocked.
  const setHardMode = (on) => {
    setHardModePref(on);
    writePreference("hardMode", on);
    dispatch({ type: "SET_HARD_MODE", on });
  };

  const [stats, setStats] = useState(() => ({
    daily: loadStats("daily"),
    unlimited: loadStats("unlimited"),
  }));

  // Record each round once, when the player's guess ends it. Resumed
  // rounds and friends' challenges don't count.
  const recordedGameRef = useRef(null);
  useEffect(() => {
    if (!state.justFinished || state.mode === "challenge") return;
    if (recordedGameRef.current === state.gameId) return;
    recordedGameRef.current = state.gameId;
    const result = { won: state.status === "won", attempts: state.attempt, day: state.day };
    setStats((prev) => {
      const next = recordResult(prev[state.mode], result);
      saveStats(state.mode, next);
      return { ...prev, [state.mode]: next };
    });
  }, [state.justFinished, state.gameId, state.mode, state.status, state.attempt, state.day]);

  // Save progress after every change so a reload resumes the round.
  useEffect(() => {
    saveGame({
      status: state.status,
      mode: state.mode,
      answer: state.answer,
      day: state.day,
      hardMode: state.hardMode,
      board: state.board,
      attempt: state.attempt,
    });
  }, [state.status, state.mode, state.answer, state.day, state.hardMode, state.board, state.attempt]);

  const closeModal = () => {
    if (modal === "help") writePreference("seenHelp", true);
    setModal(null);
  };

  useEffect(() => {
    let cancelled = false;
    loadWordList().then((words) => {
      if (cancelled) return;
      const answers = getAnswerPool(words);
      const hardMode = readPreference("hardMode", false);

      // A friend's challenge link starts a round with their word.
      const code = new URLSearchParams(window.location.search).get(CHALLENGE_PARAM);
      const challengeWord = code && decodeChallenge(code, new Set(words));
      if (challengeWord) {
        dispatch({ type: "LOADED", words, answers, mode: "challenge", answer: challengeWord, hardMode });
        return;
      }

      const mode = readPreference("mode", "unlimited") === "daily" ? "daily" : "unlimited";
      dispatch({ type: "LOADED", words, answers, ...roundFor(mode, answers, hardMode) });
      if (code) {
        clearChallengeFromUrl();
        dispatch({ type: "SHOW_MESSAGE", text: "That challenge link isn't valid" });
      }
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
      checked: state.status === "playing" ? state.hardMode : hardModePref,
      disabled: hardModeLocked,
      onChange: setHardMode,
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

  const context = {
    state,
    dispatch,
    startRound,
    openModal: setModal,
    display: { highContrast, light: theme === "light" },
  };

  return (
    <div className="App">
      <header className="topBar">
        <div className="topBarActions start">
          <HeaderButton label="How to play" onClick={() => setModal("help")}>
            ?
          </HeaderButton>
        </div>
        <h1 className="logo">
          <span className="logoWe">We</span>Wordle
        </h1>
        <div className="topBarActions">
          <HeaderButton label="Statistics" onClick={() => setModal("stats")}>
            <StatsIcon />
          </HeaderButton>
          <HeaderButton label="Settings" onClick={() => setModal("settings")}>
            <SettingsIcon />
          </HeaderButton>
        </div>
      </header>
      <AppContext.Provider value={context}>
        <Toast />
        <main className="game">
          <ModeSwitch dailyNumber={getDayNumber() + 1} />
          <Display />
          {gameOver ? <GameOver /> : <Keyboard />}
        </main>
        {modal === "help" && <HelpModal onClose={closeModal} />}
        {modal === "settings" && (
          <SettingsModal settings={settings} onClose={closeModal}>
            <button type="button" className="secondaryButton settingsAction" onClick={() => setModal("challenge")}>
              Challenge a friend with your own word
            </button>
          </SettingsModal>
        )}
        {modal === "challenge" && (
          <ChallengeModal
            // Don't suggest the daily answer: it would spoil the friend's daily.
            suggestedWord={state.status !== "playing" && state.mode !== "daily" ? state.answer : ""}
            onClose={closeModal}
          />
        )}
        {modal === "stats" && (
          <StatsModal
            stats={stats}
            initialMode={state.mode === "daily" ? "daily" : "unlimited"}
            today={getDayNumber()}
            highlight={
              state.status === "won" && state.mode !== "challenge"
                ? { mode: state.mode, attempts: state.attempt }
                : null
            }
            onClose={closeModal}
          />
        )}
      </AppContext.Provider>
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

function clearChallengeFromUrl() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(CHALLENGE_PARAM)) return;
  url.searchParams.delete(CHALLENGE_PARAM);
  window.history.replaceState(null, "", url);
}

function systemTheme() {
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export default App;
