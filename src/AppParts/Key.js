import React, { useContext } from 'react';
import { AppContext } from '../App';

function Key({ keyVal, bigKey, disabled }) {
  const { dispatch } = useContext(AppContext);

  const onClick = () => {
    if (keyVal === "ENTER") {
      dispatch({ type: "SUBMIT" });
    } else if (keyVal === "DELETE") {
      dispatch({ type: "DELETE_LETTER" });
    } else {
      dispatch({ type: "ADD_LETTER", letter: keyVal });
    }
  };

  return (
    <div className="key" id={bigKey ? "big" : disabled ? "disabled" : undefined} onClick={onClick}>
      {keyVal}
    </div>
  );
}

export default Key;
