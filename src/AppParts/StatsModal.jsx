import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import { visibleStreak, winPercent } from '../stats';

const TABS = [
  { mode: "daily", label: "Daily" },
  { mode: "unlimited", label: "Unlimited" },
];

// Your ranked rating and the top players, loaded from the server.
function RankedPanel({ loadLeaderboard }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadLeaderboard().then(setData, (e) => setError(e.message));
  }, [loadLeaderboard]);

  if (error) return <p className="challengeFeedback error">{error}</p>;
  if (!data) return <p className="muted">Loading…</p>;

  const me = data.me;
  const numbers = me
    ? [
        { label: "Rating", value: me.rating },
        { label: "Rank", value: me.rank ? `#${me.rank}` : "–" },
        { label: "Played", value: me.played },
        { label: "Win %", value: me.played ? Math.round((me.wins / me.played) * 100) : 0 },
      ]
    : [];

  return (
    <>
      {me ? (
        <dl className="statNumbers">
          {numbers.map(({ label, value }) => (
            <div key={label} className="statNumber">
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="muted">Play a ranked match (Online → Find an opponent) to get a rating.</p>
      )}
      <h3>Leaderboard</h3>
      {data.top.length === 0 ? (
        <p className="statsEmpty">No ranked games yet.</p>
      ) : (
        <ol className="leaderboard">
          {data.top.map((row) => (
            <li key={`${row.rank}-${row.name}`} className={row.is_me ? "me" : undefined}>
              <span className="muted">#{row.rank}</span>
              <span className="playerName">{row.name}</span>
              <span>{row.rating}</span>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

// highlight: { mode, attempts } of the round just won, to mark its bar.
// loadLeaderboard (optional) adds a Ranked tab.
function StatsModal({ stats, initialMode, today, highlight, loadLeaderboard, onClose }) {
  const [mode, setMode] = useState(initialMode);
  const tabs = loadLeaderboard ? [...TABS, { mode: "ranked", label: "Ranked" }] : TABS;
  const current = stats[mode] ?? stats.unlimited;
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
        {tabs.map((tab) => (
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

      {mode === "ranked" ? (
        <RankedPanel loadLeaderboard={loadLeaderboard} />
      ) : (
        <>
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
        </>
      )}
    </Modal>
  );
}

export default StatsModal;
