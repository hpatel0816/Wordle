import React from 'react';
import { MAX_GUESSES } from '../gameLogic';

function formatTime(seconds) {
  if (seconds == null) return "";
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function describe(player) {
  if (player.finished && player.solved) {
    return `${player.guesses_used}/${MAX_GUESSES} in ${formatTime(player.seconds)}`;
  }
  if (player.finished) return `X/${MAX_GUESSES}`;
  if (player.guesses_used > 0) return `Playing (${player.guesses_used} so far)`;
  return "Not started";
}

// Colors only; the words are in the title for anyone who has finished.
function MiniGrid({ rows }) {
  return (
    <span className="miniGrid" aria-hidden="true">
      {rows.map((row, r) => (
        <span className="miniRow" key={r} title={row.word.toUpperCase()}>
          {row.result.map((status, c) => (
            <span key={c} className={`miniTile ${status}`} />
          ))}
        </span>
      ))}
    </span>
  );
}

// Ranked results for a friend board: solved first, then fewer guesses,
// then faster time (the server sorts them).
function Scoreboard({ board }) {
  if (!board) return <p className="muted">Loading scoreboard…</p>;

  return (
    <section className="scoreboard" aria-labelledby="scoreboard-title">
      <h3 id="scoreboard-title">
        Scoreboard <span className="muted">· {board.players.length} {board.players.length === 1 ? "player" : "players"}</span>
      </h3>
      <ol>
        {board.players.map((player, i) => (
          <li key={i} className={player.is_me ? "me" : undefined}>
            <span className="rank">{i + 1}</span>
            <span className="playerName">
              {player.name}
              {player.is_me && <span className="muted"> (you)</span>}
            </span>
            <span className="playerScore">{describe(player)}</span>
            {player.rows && player.rows.length > 0 && <MiniGrid rows={player.rows} />}
          </li>
        ))}
      </ol>
      {board.players.length === 1 && (
        <p className="muted small">Nobody else has joined yet. Send the invite link!</p>
      )}
    </section>
  );
}

export default Scoreboard;
