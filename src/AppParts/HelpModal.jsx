import React, { useEffect, useRef } from 'react';
import { MAX_GUESSES, STATUS_LABELS, WORD_LENGTH } from '../gameLogic';

const EXAMPLES = [
  { word: "CRANE", index: 0, status: "correct", text: "C is in the word and in the correct spot." },
  { word: "PLANT", index: 1, status: "almost", text: "L is in the word but in the wrong spot." },
  { word: "MOUSE", index: 3, status: "error", text: "S is not in the word in any spot." },
];

function ExampleRow({ word, index, status }) {
  return (
    <div className="exampleRow" aria-hidden="true">
      {[...word].map((letter, i) => (
        <div key={i} className={`letter ${i === index ? status : "filled"}`}>
          {letter}
        </div>
      ))}
    </div>
  );
}

function HelpModal({ onClose }) {
  const closeRef = useRef(null);

  // Focus the dialog on open and give focus back to where it was on close.
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    closeRef.current?.focus();
    return () => previouslyFocused?.focus?.();
  }, []);

  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      onClose();
    } else if (event.key === "Tab") {
      // The close button is the only focusable element: keep focus inside.
      event.preventDefault();
      closeRef.current?.focus();
    }
  };

  return (
    <div
      className="modalBackdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        onKeyDown={onKeyDown}
      >
        <button
          ref={closeRef}
          type="button"
          className="iconButton modalClose"
          aria-label="Close"
          onClick={onClose}
        >
          ×
        </button>
        <h2 id="help-title">How To Play</h2>
        <p>Guess the hidden word in {MAX_GUESSES} tries.</p>
        <ul>
          <li>Each guess must be a valid {WORD_LENGTH}-letter word.</li>
          <li>After each guess, the tile colors show how close you were.</li>
        </ul>

        <h3>Examples</h3>
        {EXAMPLES.map((example) => (
          <div className="example" key={example.word}>
            <ExampleRow {...example} />
            <p>
              <span className="visuallyHidden">
                {example.word}: {example.word[example.index]} is {STATUS_LABELS[example.status]}.{" "}
              </span>
              <span aria-hidden="true">{example.text}</span>
            </p>
          </div>
        ))}

        <h3>Tips</h3>
        <ul>
          <li>The keyboard shows what you've learned. Ruled-out letters turn dark and can't be typed again.</li>
          <li>There's no daily limit: press Play Again after a round for a new word.</li>
          <li>Use ◐ in the top bar to switch to high-contrast colors.</li>
        </ul>
      </div>
    </div>
  );
}

export default HelpModal;
