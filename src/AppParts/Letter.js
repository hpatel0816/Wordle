import React, { useContext } from 'react';
import { AppContext } from '../App';

function Letter({ row, col }) {
  const { state } = useContext(AppContext);
  const letter = state.board[row][col];
  // undefined until the row has been submitted
  const status = state.evaluations[row]?.[col];

  return (
    <div className={["letter", status ?? (letter && "filled")].filter(Boolean).join(" ")}>
      {letter}
    </div>
  );
}

export default Letter;
