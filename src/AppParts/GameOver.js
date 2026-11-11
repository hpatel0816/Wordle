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
    <div className="gameOver" role="status">
      <p className="gameOverResult">{won ? "You Correctly Guessed" : "Could Not Guess The Word"}</p>
      <h2>Word: {state.answer.toUpperCase()}</h2>
      {won && (
        <p className="gameOverResult">
          You Guessed In {state.attempt} {state.attempt === 1 ? "Try" : "Tries"}
        </p>
      )}
      {/* autoFocus lets Enter start the next round */}
      <button type="button" className="playAgain" onClick={playAgain} autoFocus>
        Play Again
      </button>
    </div>
  );
}

export default GameOver;
