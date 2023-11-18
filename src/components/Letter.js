import React, { useContext, useEffect } from 'react';
import { AppContext } from '../Wordle';


function Letter({letterPosition, attemptValue}) {
    let lettercolor = ""

    const {display, correctWord, currAttempt, setDisabledLetter} = useContext(AppContext);
    const letter = display[attemptValue][letterPosition];


    const correct = correctWord.toUpperCase()[letterPosition] === letter;
    const almost = !correct && letter !== "" && correctWord.toUpperCase().includes(letter);

    const letterState = 
      currAttempt.attempt > attemptValue && 
      (correct ? "correct" : almost ? "almost" : "error");

      useEffect(() => {
        if (letter !== "" && !correct && !almost) {
            setDisabledLetter((prev) => [...prev, letter])
        } else if (letter !== "" && almost) {
            lettercolor = "#c8b653";
            shadeKeyBoard(letter, lettercolor)
        } else if (letter !== "" && correct) {
            lettercolor = "#6ca965"
            shadeKeyBoard(letter, lettercolor)
        }
         
      }, [currAttempt.attempt]);

      function shadeKeyBoard(letter, color) {
        for (const elem of document.getElementsByClassName("key")) {
            if (elem.textContent === letter) {
                let oldColor = elem.style.backgroundColor
                if (oldColor === 'green') {
                    return
                } 
    
                if (oldColor === 'yellow' && color !== 'green') {
                    return
                }
    
                elem.style.backgroundColor = color
                break
            }
        }
    }

    return (
      <div className="letter" id = {letterState}>
        {letter}
      </div>
    );
}

export default Letter;