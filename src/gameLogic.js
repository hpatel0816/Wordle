import { APP_NAME } from "./brand";

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

const ORDINALS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th"];

// Hard mode: every hint revealed so far must be used in the next guess.
// Green letters must stay in place, and yellow/green letters must appear
// at least as many times as earlier rows showed them. Returns a message
// explaining the first broken rule, or null when the guess is allowed.
export function getHardModeError(guess, board, evaluations) {
  const g = guess.toUpperCase();
  const required = {};

  for (let r = 0; r < evaluations.length; r++) {
    const counts = {};
    for (let c = 0; c < evaluations[r].length; c++) {
      const letter = board[r][c];
      const status = evaluations[r][c];
      if (status === "correct" && g[c] !== letter) {
        return `${ORDINALS[c]} letter must be ${letter}`;
      }
      if (status !== "error") counts[letter] = (counts[letter] || 0) + 1;
    }
    for (const [letter, count] of Object.entries(counts)) {
      required[letter] = Math.max(required[letter] || 0, count);
    }
  }

  for (const [letter, count] of Object.entries(required)) {
    if ([...g].filter((l) => l === letter).length < count) {
      return count > 1 ? `Guess must contain ${count} ${letter}s` : `Guess must contain ${letter}`;
    }
  }
  return null;
}

// ----- Daily puzzle -----

const DAY_MS = 24 * 60 * 60 * 1000;
// Daily #1 was this date. Days follow the player's local calendar.
const DAILY_EPOCH = Date.UTC(2025, 0, 1);

// 0 on the epoch date, 1 the next day, and so on.
export function getDayNumber(date = new Date()) {
  const localMidnight = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((localMidnight - DAILY_EPOCH) / DAY_MS);
}

export function msUntilNextDay(now = new Date()) {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next - now;
}

// Small seeded PRNG (mulberry32) so everyone gets the same order.
function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dailyOrders = new WeakMap();

// The answer pool shuffled once with a fixed seed, so consecutive days
// aren't neighbours in the frequency list and no word repeats until the
// whole pool has been used.
function dailyOrder(answers) {
  if (!dailyOrders.has(answers)) {
    const order = [...answers];
    const random = seededRandom(20250101);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    dailyOrders.set(answers, order);
  }
  return dailyOrders.get(answers);
}

export function getDailyAnswer(answers, day) {
  const order = dailyOrder(answers);
  return order[((day % order.length) + order.length) % order.length];
}

// ----- Sharing -----

// Emoji per tile status. The color-blind palette uses orange/blue, and the
// light theme uses a white square for absent letters.
export function shareEmoji({ highContrast = false, light = false } = {}) {
  return {
    correct: highContrast ? "🟧" : "🟩",
    almost: highContrast ? "🟦" : "🟨",
    error: light ? "⬜" : "⬛",
  };
}

// Spoiler-free result, e.g.
//   WeWordle Daily #42 4/6*
//
//   ⬛🟨⬛⬛⬛
//   ...
// "*" marks hard mode and "X/6" a loss.
export function buildShareText(state, display = {}) {
  const { mode, day, status, attempt, evaluations, hardMode } = state;
  const name = mode === "daily" ? `Daily #${day + 1}` : mode === "challenge" ? "Challenge" : "Unlimited";
  const score = status === "won" ? attempt : "X";
  const emoji = shareEmoji(display);
  const grid = evaluations.map((row) => row.map((s) => emoji[s]).join("")).join("\n");
  return `${APP_NAME} ${name} ${score}/${MAX_GUESSES}${hardMode ? "*" : ""}\n\n${grid}`;
}

// ----- Challenge links -----

// A challenge link carries the answer in the URL, lightly scrambled so it
// isn't readable at a glance (this hides it, it doesn't secure it).
const shift = (i) => 7 + 3 * i;

export function encodeChallenge(word) {
  return [...word.toLowerCase()]
    .map((ch, i) => String.fromCharCode(97 + ((ch.charCodeAt(0) - 97 + shift(i)) % 26)))
    .join("");
}

// Returns the word, or null if the code isn't a valid word.
export function decodeChallenge(code, wordSet) {
  if (typeof code !== "string" || !/^[a-z]+$/i.test(code)) return null;
  const word = [...code.toLowerCase()]
    .map((ch, i) => String.fromCharCode(97 + ((ch.charCodeAt(0) - 97 - shift(i) + 26 * 26) % 26)))
    .join("");
  return word.length === WORD_LENGTH && wordSet.has(word) ? word : null;
}

export const CHALLENGE_PARAM = "challenge";

export function challengeUrl(word, location = window.location) {
  return `${location.origin}${location.pathname}?${CHALLENGE_PARAM}=${encodeChallenge(word)}`;
}
