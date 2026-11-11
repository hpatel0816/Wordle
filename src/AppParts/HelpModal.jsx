import React from 'react';
import Modal from './Modal';
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
  return (
    <Modal title="How To Play" titleId="help-title" onClose={onClose}>
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

      <h3>Modes</h3>
      <ul>
        <li><strong>Unlimited:</strong> a new word every round. Press Play Again whenever you like.</li>
        <li><strong>Daily:</strong> one puzzle a day, the same for everyone. A new one starts at midnight.</li>
        <li><strong>Friends:</strong> start a friend board and share the link. Everyone plays the same word, then compares results on a scoreboard.</li>
        <li><strong>Challenge:</strong> after a round, send a friend a link to a word of your choice.</li>
      </ul>

      <h3>Tips</h3>
      <ul>
        <li>The keyboard shows what you've learned. Ruled-out letters turn dark and can't be typed again.</li>
        <li>Settings (the gear) has hard mode, a light theme and color-blind colors.</li>
        <li>Statistics (the bar chart) tracks your wins and streaks for each mode.</li>
      </ul>
    </Modal>
  );
}

export default HelpModal;
