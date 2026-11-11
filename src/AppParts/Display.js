import React, { useContext } from "react";
import Letter from "./Letter";
import { AppContext } from "../App";
import { STATUS_LABELS } from "../gameLogic";

// e.g. "Guess 2: C correct, R not in the word, ..."
function describeLastGuess(state) {
  const row = state.evaluations.length - 1;
  if (row < 0) return "";
  const parts = state.evaluations[row].map(
    (status, col) => `${state.board[row][col]} ${STATUS_LABELS[status]}`
  );
  return `Guess ${row + 1}: ${parts.join(", ")}`;
}

function Display() {
  const { state } = useContext(AppContext);
  return (
    <>
      <div className="display" role="group" aria-label="Game board">
        {state.board.map((letters, row) => {
          // Changing the key on each new error remounts the row, replaying the shake.
          const shake = state.message?.shake && row === state.attempt;
          return (
            <div
              className={shake ? "row shake" : "row"}
              key={shake ? `${row}-${state.message.id}` : row}
              role="group"
              aria-label={`Guess ${row + 1}`}
            >
              {letters.map((_, col) => (
                <Letter key={col} row={row} col={col} />
              ))}
            </div>
          );
        })}
      </div>
      {/* Announces each scored guess to screen-reader users. */}
      <div className="visuallyHidden" aria-live="polite" data-testid="guess-announcer">
        {describeLastGuess(state)}
      </div>
    </>
  );
}

export default Display;
