import React from 'react';

// A player's color grid without letters. Words (when the server has
// revealed them) show as a tooltip.
function MiniGrid({ rows, slots = 0 }) {
  const empty = Math.max(0, slots - rows.length);
  return (
    <span className="miniGrid" aria-hidden="true">
      {rows.map((row, r) => (
        <span className="miniRow" key={r} title={row.word ? row.word.toUpperCase() : undefined}>
          {row.result.map((status, c) => (
            <span key={c} className={`miniTile ${status}`} />
          ))}
        </span>
      ))}
      {Array.from({ length: empty }, (_, r) => (
        <span className="miniRow" key={`e${r}`}>
          {Array.from({ length: 5 }, (_, c) => (
            <span key={c} className="miniTile empty" />
          ))}
        </span>
      ))}
    </span>
  );
}

export default MiniGrid;
