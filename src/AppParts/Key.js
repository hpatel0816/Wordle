import React, { useContext } from 'react';
import { AppContext } from '../App';
import { STATUS_LABELS } from '../gameLogic';

const SPECIAL_KEYS = {
  ENTER: { text: "ENTER", label: "Enter" },
  DELETE: { text: "⌫", label: "Delete" },
};

// status is "correct" | "almost" | "error" once the letter has been guessed.
function Key({ keyVal, bigKey, status }) {
  const { dispatch } = useContext(AppContext);
  const special = SPECIAL_KEYS[keyVal];

  const onClick = () => {
    if (keyVal === "ENTER") {
      dispatch({ type: "SUBMIT" });
    } else if (keyVal === "DELETE") {
      dispatch({ type: "DELETE_LETTER" });
    } else {
      dispatch({ type: "ADD_LETTER", letter: keyVal });
    }
  };

  const label = special
    ? special.label
    : status
      ? `${keyVal}, ${STATUS_LABELS[status]}`
      : keyVal;

  return (
    <button
      type="button"
      className={["key", bigKey && "big", status].filter(Boolean).join(" ")}
      aria-label={label}
      aria-disabled={status === "error" ? "true" : undefined}
      // Keep focus off on-screen keys after a mouse click, so a later
      // physical Enter submits the guess instead of re-pressing the key.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {special ? special.text : keyVal}
    </button>
  );
}

export default Key;
