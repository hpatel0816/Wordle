import React, { useContext, useEffect, useState } from 'react';
import { AppContext } from '../App';
import { buildShareText, msUntilNextDay } from '../gameLogic';
import { SHARE_MESSAGES, shareOrCopy } from '../share';

function formatCountdown(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const parts = [Math.floor(total / 3600), Math.floor(total / 60) % 60, total % 60];
  return parts.map((n) => String(n).padStart(2, "0")).join(":");
}

// Time left until the next daily puzzle, ticking every second.
function NextDaily({ onReady }) {
  const [msLeft, setMsLeft] = useState(() => msUntilNextDay());

  useEffect(() => {
    const timer = setInterval(() => setMsLeft(msUntilNextDay()), 1000);
    return () => clearInterval(timer);
  }, []);

  // msUntilNextDay wraps to ~24h at midnight, so a jump up means a new day.
  const [startedWith] = useState(msLeft);
  const newDay = msLeft > startedWith;

  if (newDay) {
    return (
      <button type="button" className="secondaryButton" onClick={onReady}>
        Play today's puzzle
      </button>
    );
  }
  return (
    <p className="nextDaily">
      Next daily in <time role="timer" aria-live="off">{formatCountdown(msLeft)}</time>
    </p>
  );
}

function GameOver() {
  const { state, dispatch, startRound, openModal, display } = useContext(AppContext);
  const won = state.status === "won";
  const daily = state.mode === "daily";

  const share = async () => {
    const result = await shareOrCopy(buildShareText(state, display));
    if (SHARE_MESSAGES[result]) dispatch({ type: "SHOW_MESSAGE", text: SHARE_MESSAGES[result] });
  };

  return (
    <div className="gameOver" role="status">
      <p className="gameOverResult">{won ? "You Correctly Guessed" : "Could Not Guess The Word"}</p>
      <h2>Word: {state.answer.toUpperCase()}</h2>
      {won && (
        <p className="gameOverResult">
          You Guessed In {state.attempt} {state.attempt === 1 ? "Try" : "Tries"}
        </p>
      )}
      {daily && <NextDaily onReady={() => startRound("daily")} />}
      <div className="gameOverActions">
        {/* autoFocus lets Enter start the next round */}
        <button type="button" className="playAgain" onClick={() => startRound("unlimited")} autoFocus>
          {daily ? "Play Unlimited" : "Play Again"}
        </button>
        <button type="button" className="secondaryButton" onClick={share}>
          Share
        </button>
        <button type="button" className="secondaryButton" onClick={() => openModal("stats")}>
          Statistics
        </button>
      </div>
    </div>
  );
}

export default GameOver;
