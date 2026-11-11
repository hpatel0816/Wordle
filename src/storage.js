// localStorage can throw (private mode, blocked storage), so every access
// is wrapped and falls back to the default.
export function readPreference(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writePreference(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore: the preference just won't persist.
  }
}
