import React, { useContext, useEffect } from 'react';
import { AppContext } from '../App';


function Letter({letterPosition, attemptValue}) {
    const {display, correctWord, currAttempt, setDisabledLetter} = useContext(AppContext);
    const letter = display[attemptValue][letterPosition];


    const correct = correctWord.toUpperCase()[letterPosition] === letter;
    const almost = !correct && letter !== "" && correctWord.toUpperCase().includes(letter);

    const letterState = 
      currAttempt.attempt > attemptValue && 
      (correct ? "correct" : almost ? "almost" : "error");

      useEffect(() => {
        if (letter !== "" && !correct && !almost) {
            setDisabledLetter((prev) => [...prev, letter]);
        }
         
      }, [currAttempt.attempt]);

    return (
      <div className="letter" id = {letterState}>
        {letter}
      </div>
    );
}

export default Letter;