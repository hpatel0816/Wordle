import React, { useEffect, useState } from 'react';
import Modal from './Modal';

// Friend boards: pick a display name, create a board, or (when opened from
// an invite link) join one.
function FriendsModal({ friends, hardMode, inBoard, onCopyInvite, onClose }) {
  const { profile, loadProfile, invite, saveName, createBoard, createDuel } = friends;
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

  const needsName = profile === null || editingName || (invite && !profile);
  const onSubmitName = (event) => {
    event.preventDefault();
    run(async () => {
      await saveName(name);
      setEditingName(false);
    });
  };

  return (
    <Modal
      title={invite ? (invite.kind === "duel" ? "Join a Live Duel" : "Join a Friend Board") : "Play with Friends"}
      titleId="friends-title"
      onClose={onClose}
    >
      {invite ? (
        <p>
          <strong>{invite.creator}</strong>{" "}
          {invite.kind === "duel"
            ? "invited you to a live duel. Everyone races on the same word, and the first to solve it wins."
            : "invited you to a friend board. Everyone plays the same word, then compares results on a shared scoreboard."}
        </p>
      ) : (
        <ul className="friendsIntro">
          <li><strong>Live duel:</strong> race friends on the same word. First to solve it wins.</li>
          <li><strong>Friend board:</strong> everyone plays the same word whenever they like, then compares results.</li>
        </ul>
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
          <p className="muted small">Shown to other players on the scoreboard.</p>
        </form>
      )}

      {profile && !editingName && !invite && (
        <>
          <p>
            Playing as <strong>{profile.display_name}</strong>{" "}
            <button type="button" className="linkButton" onClick={() => {
              setName(profile.display_name);
              setEditingName(true);
            }}>
              Change
            </button>
          </p>
          <div className="friendsActions">
            {inBoard && (
              <button type="button" className="secondaryButton" onClick={onCopyInvite}>
                Copy invite link
              </button>
            )}
            <button
              type="button"
              className="playAgain"
              disabled={busy}
              onClick={() => run(() => createDuel(hardMode))}
            >
              Start a live duel
            </button>
            <button
              type="button"
              className="secondaryButton"
              disabled={busy}
              onClick={() => run(() => createBoard(hardMode))}
            >
              {inBoard ? "New friend board" : "Create a friend board"}
            </button>
          </div>
          <p className="muted small">
            Hard mode is {hardMode ? "on" : "off"} for new games (change it in Settings).
          </p>
        </>
      )}

      <p className={feedback?.error ? "challengeFeedback error" : "challengeFeedback"} role="status">
        {feedback?.text}
      </p>
    </Modal>
  );
}

export default FriendsModal;
