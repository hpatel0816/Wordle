import React, { useContext } from 'react';
import { AppContext } from '../App';

// status is "correct" | "almost" | "error" once the letter has been guessed.
function Key({ keyVal, bigKey, status }) {
  const { dispatch } = useContext(AppContext);

  const onClick = () => {
    if (keyVal === "ENTER") {
      dispatch({ type: "SUBMIT" });
    } else if (keyVal === "DELETE") {
      dispatch({ type: "DELETE_LETTER" });
    } else {
      dispatch({ type: "ADD_LETTER", letter: keyVal });
    }
  };

  return (
    <div
      className={["key", bigKey && "big", status].filter(Boolean).join(" ")}
      aria-disabled={status === "error" ? "true" : undefined}
      onClick={onClick}
    >
      {keyVal}
    </div>
  );
}

export default Key;
