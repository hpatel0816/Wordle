import React, { useContext } from 'react';
import { AppContext } from '../App';
import { scoreGuess } from '../gameLogic';


function Letter({letterPosition, attemptValue}) {
    const {display, correctWord, currAttempt} = useContext(AppContext);
    const letter = display[attemptValue][letterPosition];

    // Only color rows that have been submitted.
    const letterState = currAttempt.attempt > attemptValue
      ? scoreGuess(display[attemptValue].join(""), correctWord)[letterPosition]
      : undefined;

    return (
      <div className="letter" id = {letterState}>
        {letter}
      </div>
    );
}

export default Letter;
