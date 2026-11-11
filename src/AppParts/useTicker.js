import { useEffect, useState } from 'react';

// Re-renders every `ms` and returns the current time from `now()`.
export function useTicker(now, ms = 250) {
  const [time, setTime] = useState(() => now());
  useEffect(() => {
    const timer = setInterval(() => setTime(now()), ms);
    return () => clearInterval(timer);
  }, [now, ms]);
  return time;
}

export function formatClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
