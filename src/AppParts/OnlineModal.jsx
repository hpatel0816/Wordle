import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import { formatClock, useTicker } from './useTicker';

// Offer the computer after this long without an opponent.
const OFFER_BOT_AFTER_MS = 20000;

const now = () => Date.now();

// Ranked matchmaking while it's searching.
function Searching({ search, onCancel, onPlayBot }) {
  const time = useTicker(now, 500);
  if (search.error) {
    return (
      <p className="challengeFeedback error" role="alert">
        {search.error}
      </p>
    );
  }
  const waited = time - search.since;
  return (
    <div className="searching" role="status">
      <p>
        <span className="spinner" aria-hidden="true" /> Finding an opponent…{" "}
        <span className="muted">{formatClock(waited)}</span>
      </p>
      <div className="friendsActions">
        <button type="button" className="secondaryButton" onClick={onCancel}>
          Cancel
        </button>
        {waited >= OFFER_BOT_AFTER_MS && (
          <button type="button" className="secondaryButton" onClick={onPlayBot}>
            Play the computer instead
          </button>
        )}
      </div>
      {waited >= OFFER_BOT_AFTER_MS && (
        <p className="muted small">Nobody else is looking right now. Games against the computer aren't ranked.</p>
      )}
    </div>
  );
}

// Online play: ranked matches, live duels and friend boards, plus a
// practice duel against the computer. Asks for a display name first.
function OnlineModal({ online, hardMode, inGame, onCopyInvite, onPlayBot, onClose }) {
  const { profile, loadProfile, invite, saveName, createBoard, createDuel, search, findOpponent, cancelSearch } = online;
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null); // { text, error }

  useEffect(() => {
    loadProfile().catch((error) => setFeedback({ text: error.message, error: true }));
  }, [loadProfile]);

  const run = async (task) => {
    setBusy(true);
    setFeedback(null);
    try {
      await task();
    } catch (error) {
      setFeedback({ text: error.message, error: true });
    } finally {
      setBusy(false);
    }
  };

  const needsName = profile === null || editingName;
  const onSubmitName = (event) => {
    event.preventDefault();
    run(async () => {
      await saveName(name);
      setEditingName(false);
    });
  };

  let title = "Play Online";
  if (invite) title = invite.kind === "duel" ? "Join a Live Duel" : "Join a Friend Board";

  return (
    <Modal title={title} titleId="online-title" onClose={onClose}>
      {invite && (
        <p>
          <strong>{invite.creator}</strong>{" "}
          {invite.kind === "duel"
            ? "invited you to a live duel. Everyone races on the same word, and the first to solve it wins."
            : "invited you to a friend board. Everyone plays the same word, then compares results on a shared scoreboard."}
        </p>
      )}

      {profile === undefined && !feedback && <p className="muted">Connecting…</p>}

      {needsName && profile !== undefined && (
        <form className="challengeForm" onSubmit={onSubmitName}>
          <label htmlFor="display-name">Your name</label>
          <div className="challengeRow">
            <input
              id="display-name"
              className="nameInput"
              value={name}
              maxLength={16}
              autoComplete="nickname"
              placeholder="e.g. Sam"
              onChange={(event) => setName(event.target.value)}
            />
            <button type="submit" className="playAgain" disabled={busy}>
              {invite ? "Join" : "Save"}
            </button>
          </div>
          <p className="muted small">Shown to other players.</p>
        </form>
      )}

      {profile && !editingName && !invite && (
        <>
          <p>
            Playing as <strong>{profile.display_name}</strong>
            {profile.rating != null && <> · rating <strong>{profile.rating}</strong></>}{" "}
            <button
              type="button"
              className="linkButton"
              onClick={() => {
                setName(profile.display_name);
                setEditingName(true);
              }}
            >
              Change name
            </button>
          </p>

          <h3>Ranked</h3>
          {search ? (
            <Searching search={search} onCancel={cancelSearch} onPlayBot={onPlayBot} />
          ) : (
            <>
              <p className="muted small">Play someone at your level, 1 on 1. Win to raise your rating.</p>
              <div className="friendsActions">
                <button type="button" className="playAgain" disabled={busy} onClick={findOpponent}>
                  Find an opponent
                </button>
              </div>
            </>
          )}

          <h3>With friends</h3>
          <ul className="friendsIntro muted small">
            <li><strong>Live duel:</strong> race on the same word. First to solve it wins.</li>
            <li><strong>Friend board:</strong> everyone plays whenever they like, then compares results.</li>
          </ul>
          <div className="friendsActions">
            {inGame && (
              <button type="button" className="secondaryButton" onClick={onCopyInvite}>
                Copy invite link
              </button>
            )}
            <button type="button" className="secondaryButton" disabled={busy} onClick={() => run(() => createDuel(hardMode))}>
              Start a live duel
            </button>
            <button type="button" className="secondaryButton" disabled={busy} onClick={() => run(() => createBoard(hardMode))}>
              {inGame ? "New friend board" : "Create a friend board"}
            </button>
          </div>
          <p className="muted small">
            Hard mode is {hardMode ? "on" : "off"} for duels and boards you start (change it in Settings).
            Ranked games never use hard mode.
          </p>

          <p className="small">
            <button type="button" className="linkButton" onClick={onPlayBot}>
              Practice against the computer
            </button>
          </p>
        </>
      )}

      <p className={feedback?.error ? "challengeFeedback error" : "challengeFeedback"} role="status">
        {feedback?.text}
      </p>
    </Modal>
  );
}

export default OnlineModal;
