import React, { useContext } from 'react';
import { AppContext } from '../App';
import MiniGrid from './MiniGrid';
import { formatClock, useTicker } from './useTicker';
import { MAX_GUESSES } from '../gameLogic';

// During a duel: time left and each opponent's colors, live.
function DuelBar() {
  const { match, online } = useContext(AppContext);
  const now = useTicker(online.serverNow, 500);
  if (!match || match.status !== "active") return null;

  const opponents = match.players.filter((p) => !p.is_me);
  const left = Date.parse(match.ends_at) - now;

  return (
    <div className="duelBar">
      <span className={left < 30000 ? "duelTimer urgent" : "duelTimer"} role="timer" aria-live="off" aria-label="Time left">
        {formatClock(left)}
      </span>
      <ul className="opponents" aria-label="Opponents">
        {opponents.map((p, i) => (
          <li key={i} className="opponent">
            <MiniGrid rows={p.rows ?? []} slots={MAX_GUESSES} />
            <span className="opponentName">{p.name}</span>
            <span className="visuallyHidden">
              {p.finished ? "out of guesses" : `${p.guesses_used} ${p.guesses_used === 1 ? "guess" : "guesses"}`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default DuelBar;
