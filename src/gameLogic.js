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

// Screen-reader wording for each tile/key status.
export const STATUS_LABELS = {
  correct: "correct",
  almost: "in the word, wrong spot",
  error: "not in the word",
};

const STATUS_RANK = { error: 1, almost: 2, correct: 3 };

// Best-known status per letter across all submitted rows, e.g.
// { A: "correct", E: "almost", T: "error" }. A letter whose best status
// is "error" is not in the answer at all.
export function getKeyStatuses(board, evaluations) {
  const statuses = {};
  evaluations.forEach((rowStatuses, r) => {
    rowStatuses.forEach((status, c) => {
      const letter = board[r][c];
      if (!statuses[letter] || STATUS_RANK[status] > STATUS_RANK[statuses[letter]]) {
        statuses[letter] = status;
      }
    });
  });
  return statuses;
}

// Word-Bank.txt is ordered from most to least common, so the answer pool
// is its first ANSWER_POOL_SIZE words. Every word stays a valid guess.
export const ANSWER_POOL_SIZE = 1500;

// Words that are valid guesses but shouldn't be picked as the answer.
export const ANSWER_EXCLUSIONS = new Set([
  "queer", "slave", "bitch", "whore", "sluts", "dicks", "cunts", "pussy",
  "penis", "porno", "horny", "boobs", "titty", "dildo", "kikes", "spics",
  "gooks", "fagot", "dykes", "homos", "rapes", "raped", "semen", "sexed",
]);

export function getAnswerPool(words) {
  return words.slice(0, ANSWER_POOL_SIZE).filter((word) => !ANSWER_EXCLUSIONS.has(word));
}

export function pickAnswer(words, random = Math.random) {
  return words[Math.floor(random() * words.length)];
}
