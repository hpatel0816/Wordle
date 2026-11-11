import React, { useContext } from 'react';
import { AppContext } from '../App';
import { onlineEnabled } from '../online/api';

const MODES = [
  { mode: "unlimited", label: () => "Unlimited" },
  { mode: "daily", label: (dailyNumber) => `Daily #${dailyNumber}` },
];

// Segmented control for picking Unlimited or today's Daily puzzle.
function ModeSwitch({ dailyNumber }) {
  const { state, startRound, openModal } = useContext(AppContext);
  if (state.status === "loading") return null;

  return (
    <nav className="modeSwitch" aria-label="Game mode">
      {MODES.map(({ mode, label }) => (
        <button
          key={mode}
          type="button"
          aria-pressed={state.mode === mode}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => state.mode !== mode && startRound(mode)}
        >
          {label(dailyNumber)}
        </button>
      ))}
      {onlineEnabled && (
        <button
          type="button"
          aria-pressed={state.mode === "board"}
          aria-haspopup="dialog"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => openModal("friends")}
        >
          Friends
        </button>
      )}
      {state.mode === "challenge" && (
        <button type="button" aria-pressed="true" disabled>
          Friend's challenge
        </button>
      )}
    </nav>
  );
}

export default ModeSwitch;
