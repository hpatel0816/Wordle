import React, {useContext} from 'react'
import { AppContext } from '../Wordle';

function GameOver() {
    const {gameOver, setGameOver, correctWord, currAttempt} = useContext(AppContext)
  return (
    <div className = "gameOver">
        <h3>{gameOver.guessedWord ? "You Correctly Guessed" : "Could Not Guess The Word"}</h3>
        <h1>Word: {correctWord}</h1>
        {gameOver.guessedWord && (<h3> You Guessed In {currAttempt.attempt} Tries</h3>)}
    </div>
  );
}

export default GameOver;