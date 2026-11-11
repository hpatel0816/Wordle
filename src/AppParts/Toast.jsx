import React, { useContext, useEffect } from 'react';
import { AppContext } from '../App';

const TOAST_MS = 1500;

// Shows the latest game message briefly, then clears it.
function Toast() {
  const { state, dispatch } = useContext(AppContext);
  const message = state.message;

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => dispatch({ type: "CLEAR_MESSAGE", id: message.id }), TOAST_MS);
    return () => clearTimeout(timer);
  }, [message, dispatch]);

  return (
    <div className="toastRegion" role="status" aria-live="polite">
      {message && (
        <div className="toast" key={message.id}>
          {message.text}
        </div>
      )}
    </div>
  );
}

export default Toast;
