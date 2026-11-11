import React, { useContext } from 'react';
import Key from './Key';
import { AppContext } from '../App';
import { getKeyStatuses } from '../gameLogic';

const KEY_ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "DELETE"],
];

function Keyboard() {
  const { state } = useContext(AppContext);
  const keyStatuses = getKeyStatuses(state.board, state.evaluations);

  return (
    <div className="keyboard" role="group" aria-label="Keyboard">
      {KEY_ROWS.map((keys, i) => (
        <div className={i === 1 ? "keyboardRow offset" : "keyboardRow"} key={i}>
          {keys.map((key) => (
            <Key
              key={key}
              keyVal={key}
              bigKey={key.length > 1}
              status={keyStatuses[key]}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export default Keyboard;
