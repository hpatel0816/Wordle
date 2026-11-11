export const WORD_LENGTH = 5;
export const MAX_GUESSES = 6;

// Split the raw word bank into lowercase words, tolerating LF or CRLF.
export function parseWordList(text) {
  return text
    .split(/\r?\n/)
    .map((word) => word.trim().toLowerCase())
    .filter(Boolean);
}

// Score a guess against the answer using standard rules:
// exact matches first, then "almost" only while unmatched copies of
// that letter remain in the answer. Returns one of
// "correct" | "almost" | "error" per position.
export function scoreGuess(guess, answer) {
  const g = guess.toLowerCase();
  const a = answer.toLowerCase();
  const result = Array(g.length).fill("error");
  const remaining = {};

  for (let i = 0; i < g.length; i++) {
    if (g[i] === a[i]) {
      result[i] = "correct";
    } else {
      remaining[a[i]] = (remaining[a[i]] || 0) + 1;
    }
  }

  for (let i = 0; i < g.length; i++) {
    if (result[i] !== "correct" && remaining[g[i]] > 0) {
      result[i] = "almost";
      remaining[g[i]]--;
    }
  }

  return result;
}
