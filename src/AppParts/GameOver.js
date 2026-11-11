import React, { useContext } from 'react';
import { AppContext } from '../App';
import { pickAnswer } from '../gameLogic';

function GameOver() {
  const { state, dispatch } = useContext(AppContext);
  const won = state.status === "won";

  const playAgain = () => {
    dispatch({ type: "NEW_GAME", answer: pickAnswer(state.words) });
  };

  return (
    <div className="gameOver">
      <h3>{won ? "You Correctly Guessed" : "Could Not Guess The Word"}</h3>
      <h1>Word: {state.answer.toUpperCase()}</h1>
      {won && <h3>You Guessed In {state.attempt} {state.attempt === 1 ? "Try" : "Tries"}</h3>}
      {/* autoFocus lets Enter start the next round */}
      <button className="playAgain" onClick={playAgain} autoFocus>
        Play Again
      </button>
    </div>
  );
}

export default GameOver;
