import React, { useContext, useState } from 'react';
import Modal from './Modal';
import { AppContext } from '../App';
import { WORD_LENGTH, challengeUrl } from '../gameLogic';
import { shareOrCopy } from '../share';
import { APP_NAME } from '../brand';

// Make a link that gives a friend a round with a word of the player's choice.
function ChallengeModal({ suggestedWord = "", onClose }) {
  const { state } = useContext(AppContext);
  const [word, setWord] = useState(suggestedWord.toUpperCase());
  const [feedback, setFeedback] = useState(null); // { text, error }

  const onSubmit = async (event) => {
    event.preventDefault();
    const guess = word.toLowerCase();
    if (guess.length !== WORD_LENGTH) {
      setFeedback({ text: `Enter a ${WORD_LENGTH}-letter word`, error: true });
      return;
    }
    if (!state.wordSet.has(guess)) {
      setFeedback({ text: "Not in word list", error: true });
      return;
    }
    const url = challengeUrl(guess);
    const result = await shareOrCopy(`Can you guess my ${APP_NAME} word? ${url}`);
    if (result === "copied") setFeedback({ text: "Link copied. Send it to a friend!" });
    else if (result === "shared") setFeedback({ text: "Link shared!" });
    else if (result === "failed") setFeedback({ text: `Copy this link: ${url}` });
  };

  return (
    <Modal title="Challenge a Friend" titleId="challenge-title" onClose={onClose}>
      <p>Pick a word and send the link. Your friend gets a round with that word as the answer.</p>
      <form className="challengeForm" onSubmit={onSubmit}>
        <label htmlFor="challenge-word">Word</label>
        <div className="challengeRow">
          <input
            id="challenge-word"
            className="challengeInput"
            value={word}
            maxLength={WORD_LENGTH}
            autoComplete="off"
            spellCheck="false"
            aria-invalid={feedback?.error || undefined}
            aria-describedby="challenge-feedback"
            onChange={(event) => {
              setWord(event.target.value.replace(/[^a-z]/gi, "").toUpperCase());
              setFeedback(null);
            }}
          />
          <button type="submit" className="playAgain">
            Copy link
          </button>
        </div>
        <p
          id="challenge-feedback"
          className={feedback?.error ? "challengeFeedback error" : "challengeFeedback"}
          role="status"
        >
          {feedback?.text}
        </p>
      </form>
    </Modal>
  );
}

export default ChallengeModal;
