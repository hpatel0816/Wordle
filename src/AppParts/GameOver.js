import React, { useContext } from 'react';
import { AppContext } from '../App';

function GameOver() {
  const { state } = useContext(AppContext);
  const won = state.status === "won";

  return (
    <div className="gameOver">
      <h3>{won ? "You Correctly Guessed" : "Could Not Guess The Word"}</h3>
      <h1>Word: {state.answer.toUpperCase()}</h1>
      {won && <h3>You Guessed In {state.attempt} Tries</h3>}
    </div>
  );
}

export default GameOver;
