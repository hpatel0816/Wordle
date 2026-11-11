import React, { useContext } from 'react';
import { AppContext } from '../App';
import { STATUS_LABELS } from '../gameLogic';

function Letter({ row, col }) {
  const { state } = useContext(AppContext);
  const letter = state.board[row][col];
  // undefined until the row has been submitted
  const status = state.evaluations[row]?.[col];

  return (
    <div className={["letter", status ?? (letter && "filled")].filter(Boolean).join(" ")}>
      {letter}
      {status && <span className="visuallyHidden">, {STATUS_LABELS[status]}</span>}
    </div>
  );
}

export default Letter;
