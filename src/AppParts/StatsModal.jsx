import React, { useState } from 'react';
import Modal from './Modal';
import { visibleStreak, winPercent } from '../stats';

const TABS = [
  { mode: "daily", label: "Daily" },
  { mode: "unlimited", label: "Unlimited" },
];

// highlight: { mode, attempts } of the round just won, to mark its bar.
function StatsModal({ stats, initialMode, today, highlight, onClose }) {
  const [mode, setMode] = useState(initialMode);
  const current = stats[mode];
  const most = Math.max(1, ...current.distribution);

  const numbers = [
    { label: "Played", value: current.played },
    { label: "Win %", value: winPercent(current) },
    { label: "Current Streak", value: visibleStreak(current, mode === "daily" ? today : null) },
    { label: "Max Streak", value: current.maxStreak },
  ];

  return (
    <Modal title="Statistics" titleId="stats-title" onClose={onClose}>
      <div className="statsTabs" role="group" aria-label="Show statistics for">
        {TABS.map((tab) => (
          <button
            key={tab.mode}
            type="button"
            aria-pressed={mode === tab.mode}
            onClick={() => setMode(tab.mode)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <dl className="statNumbers">
        {numbers.map(({ label, value }) => (
          <div key={label} className="statNumber">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <h3>Guess Distribution</h3>
      {current.played === 0 ? (
        <p className="statsEmpty">No {mode} games yet.</p>
      ) : (
        <ol className="distribution">
          {current.distribution.map((count, i) => {
            const isLatest = highlight?.mode === mode && highlight.attempts === i + 1;
            return (
              <li key={i} className="distributionRow">
                <span className="distributionGuess" aria-hidden="true">{i + 1}</span>
                <span className="visuallyHidden">
                  {i + 1} {i === 0 ? "guess" : "guesses"}: {count} {count === 1 ? "win" : "wins"}
                </span>
                <span className="distributionTrack" aria-hidden="true">
                  <span
                    className={isLatest ? "distributionBar latest" : "distributionBar"}
                    style={{ width: `${Math.max(7, (count / most) * 100)}%` }}
                  >
                    {count}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </Modal>
  );
}

export default StatsModal;
