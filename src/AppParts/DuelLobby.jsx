import React, { useContext } from 'react';
import { AppContext } from '../App';
import { formatClock, useTicker } from './useTicker';

// Shown instead of the keyboard before a duel starts: who's in, the invite
// link, the host's Start button, then a short countdown.
function DuelLobby() {
  const { match, online, clock, copyInvite } = useContext(AppContext);
  const now = useTicker(clock);
  if (!match) return null;

  if (match.status === "active") {
    const left = Date.parse(match.starts_at) - now;
    return (
      <div className="duelLobby" role="status">
        <p className="countdown">{left > 0 ? Math.ceil(left / 1000) : "Go!"}</p>
      </div>
    );
  }

  const players = match.players;
  const canStart = players.length >= 2;
  const host = players.find((p) => p.is_host)?.name ?? match.creator;
  const lobbyLeft = Date.parse(match.ends_at) - now;

  return (
    <div className="duelLobby">
      <h2>Live duel</h2>
      <p className="muted small">
        First to solve the word wins. 5 minutes, same word for everyone.
        {match.hard_mode && " Hard mode."}
      </p>
      <ul className="lobbyPlayers" aria-label="Players in the lobby">
        {players.map((p, i) => (
          <li key={i}>
            {p.name}
            {p.is_me && <span className="muted"> (you)</span>}
            {p.is_host && <span className="tag">host</span>}
          </li>
        ))}
      </ul>
      <div className="gameOverActions">
        <button type="button" className="secondaryButton" onClick={copyInvite}>
          Copy invite link
        </button>
        {match.is_host && (
          <button type="button" className="playAgain" disabled={!canStart} onClick={online.startDuel}>
            Start duel
          </button>
        )}
      </div>
      <p className="muted small" role="status">
        {match.is_host
          ? canStart
            ? `${players.length} players ready. Start when everyone's in.`
            : "Waiting for a friend to join…"
          : `Waiting for ${host} to start…`}
        {lobbyLeft < 10 * 60 * 1000 && ` Lobby closes in ${formatClock(lobbyLeft)}.`}
      </p>
    </div>
  );
}

export default DuelLobby;
