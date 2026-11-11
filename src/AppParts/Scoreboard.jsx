import React from 'react';
import { MAX_GUESSES } from '../gameLogic';
import MiniGrid from './MiniGrid';

function formatTime(seconds) {
  if (seconds == null) return "";
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function describe(player, duelOver) {
  if (player.is_winner && player.solved) {
    return `🏆 ${player.guesses_used}/${MAX_GUESSES} in ${formatTime(player.seconds)}`;
  }
  if (player.finished && player.solved) {
    return `${player.guesses_used}/${MAX_GUESSES} in ${formatTime(player.seconds)}`;
  }
  if (player.finished) return `X/${MAX_GUESSES}`;
  if (duelOver) return `${player.guesses_used} ${player.guesses_used === 1 ? "guess" : "guesses"}`;
  if (player.guesses_used > 0) return `Playing (${player.guesses_used} so far)`;
  return "Not started";
}

// Ranked results for a friend board or duel: the duel winner, then solved,
// fewer guesses and faster time (the server sorts them).
function Scoreboard({ board }) {
  if (!board) return <p className="muted">Loading scoreboard…</p>;
  const duelOver = board.kind === "duel" && board.status === "finished";

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
            <span className="playerScore">
              {describe(player, duelOver)}
              {player.rating_change != null && (
                <span className="muted"> · {player.rating_change >= 0 ? "+" : "−"}{Math.abs(player.rating_change)}</span>
              )}
            </span>
            {player.rows && player.rows.length > 0 && <MiniGrid rows={player.rows} />}
          </li>
        ))}
      </ol>
      {board.players.length === 1 && board.kind !== "duel" && (
        <p className="muted small">Nobody else has joined yet. Send the invite link!</p>
      )}
    </section>
  );
}

export default Scoreboard;
