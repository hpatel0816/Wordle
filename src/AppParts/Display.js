import React, { useContext } from "react";
import Letter from "./Letter";
import { AppContext } from "../App";

function Display() {
  const { state } = useContext(AppContext);
  return (
    <div className="display">
      {state.board.map((letters, row) => {
        // Changing the key on each new error remounts the row, replaying the shake.
        const shake = state.message?.shake && row === state.attempt;
        return (
          <div
            className={shake ? "row shake" : "row"}
            key={shake ? `${row}-${state.message.id}` : row}
          >
            {letters.map((_, col) => (
              <Letter key={col} row={row} col={col} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

export default Display;
