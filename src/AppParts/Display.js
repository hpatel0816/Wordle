import React, { useContext } from "react";
import Letter from "./Letter";
import { AppContext } from "../App";

function Display() {
  const { state } = useContext(AppContext);
  return (
    <div className="display">
      {state.board.map((letters, row) => (
        <div className="row" key={row}>
          {letters.map((_, col) => (
            <Letter key={col} row={row} col={col} />
          ))}
        </div>
      ))}
    </div>
  );
}

export default Display;
