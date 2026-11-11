import { gameReducer, initialState } from "./gameState";

// The NACRE-style entries reuse only CRANE's letters, so no letter gets
// ruled out and six wrong guesses can be made in a row.
const WORDS = ["crane", "about", "nacre", "caner", "rance", "ancre", "acern", "recan"];

function loaded(answer = "crane") {
  return gameReducer(initialState, { type: "LOADED", words: WORDS, answers: WORDS, answer });
}

function type(state, word) {
  return [...word].reduce((s, letter) => gameReducer(s, { type: "ADD_LETTER", letter }), state);
}

function guess(state, word) {
  return gameReducer(type(state, word), { type: "SUBMIT" });
}

test("ignores input while the word list is loading", () => {
  expect(gameReducer(initialState, { type: "ADD_LETTER", letter: "a" })).toBe(initialState);
});

test("typing fills the current row in uppercase without mutating the old board", () => {
  const before = loaded();
  const after = type(before, "ab");
  expect(after.board[0]).toEqual(["A", "B", "", "", ""]);
  expect(before.board[0]).toEqual(["", "", "", "", ""]);
  expect(after.letterPos).toBe(2);
});

test("a row holds at most five letters and delete stops at the start", () => {
  let state = type(loaded(), "abouts");
  expect(state.board[0].join("")).toBe("ABOUT");
  for (let i = 0; i < 7; i++) state = gameReducer(state, { type: "DELETE_LETTER" });
  expect(state.board[0].join("")).toBe("");
  expect(state.letterPos).toBe(0);
});

test("submitting an incomplete row shows a message and keeps the row", () => {
  const state = gameReducer(type(loaded(), "abo"), { type: "SUBMIT" });
  expect(state.message).toMatchObject({ text: "Not enough letters", shake: true });
  expect(state.attempt).toBe(0);
  expect(state.letterPos).toBe(3);
});

test("an unknown word sets a message and keeps the row", () => {
  const state = guess(loaded(), "zzzzz");
  expect(state.message).toMatchObject({ text: "Not in word list", shake: true });
  expect(state.attempt).toBe(0);
  expect(state.letterPos).toBe(5);
});

test("a valid guess is scored and moves to the next row", () => {
  const state = guess(loaded(), "about");
  expect(state.attempt).toBe(1);
  expect(state.evaluations[0]).toEqual(["almost", "error", "error", "error", "error"]);
  expect(state.status).toBe("playing");
});

test("guessing the answer wins and blocks further input", () => {
  const state = guess(loaded(), "crane");
  expect(state.status).toBe("won");
  expect(gameReducer(state, { type: "ADD_LETTER", letter: "a" })).toBe(state);
});

test("six wrong guesses lose", () => {
  let state = loaded();
  ["nacre", "caner", "rance", "ancre", "acern"].forEach((w) => (state = guess(state, w)));
  expect(state.status).toBe("playing");
  state = guess(state, "recan");
  expect(state.status).toBe("lost");
});

test("NEW_GAME resets the board with a new answer and keeps the word lists", () => {
  const finished = guess(loaded(), "crane");
  const next = gameReducer(finished, { type: "NEW_GAME", answer: "about" });
  expect(next.status).toBe("playing");
  expect(next.answer).toBe("about");
  expect(next.attempt).toBe(0);
  expect(next.evaluations).toEqual([]);
  expect(next.board.flat().every((l) => l === "")).toBe(true);
  expect(next.wordSet.has("crane")).toBe(true);
  expect(next.answers).toEqual(WORDS);
});

test("repeating an error gives a new message id", () => {
  const first = guess(loaded(), "zzzzz");
  const second = gameReducer(first, { type: "SUBMIT" });
  expect(second.message.id).not.toBe(first.message.id);
});

test("CLEAR_MESSAGE only clears the matching message", () => {
  const state = guess(loaded(), "zzzzz");
  expect(gameReducer(state, { type: "CLEAR_MESSAGE", id: -1 })).toBe(state);
  expect(gameReducer(state, { type: "CLEAR_MESSAGE", id: state.message.id }).message).toBeNull();
});

test("letters ruled out by earlier guesses cannot be typed", () => {
  // ABOUT vs CRANE: B, O, U, T are absent; A is present elsewhere.
  const afterGuess = guess(loaded(), "about");
  const blocked = gameReducer(afterGuess, { type: "ADD_LETTER", letter: "t" });
  expect(blocked.board[1]).toEqual(["", "", "", "", ""]);
  expect(blocked.message).toMatchObject({ text: "T is not in the word", shake: false });

  const allowed = gameReducer(afterGuess, { type: "ADD_LETTER", letter: "a" });
  expect(allowed.board[1][0]).toBe("A");
});

describe("hard mode", () => {
  const hard = (answer = "crane") => gameReducer(loaded(answer), { type: "SET_HARD_MODE", on: true });

  test("rejects a guess that ignores a revealed hint, without using a row", () => {
    const state = guess(guess(hard(), "about"), "recan");
    expect(state.attempt).toBe(2);
    const rejected = guess(guess(hard(), "nacre"), "about");
    expect(rejected.attempt).toBe(1);
    expect(rejected.message).toMatchObject({ text: "5th letter must be E", shake: true });
  });

  test("can only be switched at the start of a round", () => {
    const midRound = guess(loaded(), "about");
    const state = gameReducer(midRound, { type: "SET_HARD_MODE", on: true });
    expect(state.hardMode).toBe(false);
    expect(state.message.text).toBe("Hard mode can only be changed at the start of a round");

    // A finished round keeps the setting it was played with.
    const over = guess(midRound, "crane");
    expect(gameReducer(over, { type: "SET_HARD_MODE", on: true }).hardMode).toBe(false);
    expect(gameReducer(over, { type: "START", answer: "about", hardMode: true }).hardMode).toBe(true);
  });

  test("stays on for the next round", () => {
    const over = guess(hard(), "crane");
    expect(gameReducer(over, { type: "NEW_GAME", answer: "about" }).hardMode).toBe(true);
  });
});

describe("START", () => {
  test("replays saved guesses without validating them again", () => {
    const state = gameReducer(loaded(), {
      type: "START",
      answer: "crane",
      mode: "daily",
      day: 7,
      guesses: ["about", "nacre"],
    });
    expect(state).toMatchObject({ mode: "daily", day: 7, attempt: 2, status: "playing", letterPos: 0 });
    expect(state.board[1].join("")).toBe("NACRE");
    expect(state.evaluations[1]).toEqual(["almost", "almost", "almost", "almost", "correct"]);
  });

  test("a replayed winning guess ends the round", () => {
    const state = gameReducer(loaded(), { type: "START", answer: "crane", guesses: ["about", "crane"] });
    expect(state.status).toBe("won");
    expect(state.attempt).toBe(2);
  });

  test("each round gets a new gameId", () => {
    const first = loaded();
    expect(gameReducer(first, { type: "START", answer: "about" }).gameId).toBe(first.gameId + 1);
  });
});

describe("friend boards", () => {
  const board = () =>
    gameReducer(loaded(), { type: "START", mode: "board", boardId: "b1", hardMode: false });

  test("a valid guess waits for the server instead of being scored locally", () => {
    const state = guess(board(), "about");
    expect(state).toMatchObject({ pending: true, attempt: 0, answer: "" });
    expect(state.evaluations).toEqual([]);
    // Input is locked while waiting.
    expect(gameReducer(state, { type: "ADD_LETTER", letter: "c" })).toBe(state);
    expect(gameReducer(state, { type: "DELETE_LETTER" })).toBe(state);
  });

  test("local checks still reject bad words before anything is sent", () => {
    const state = guess(board(), "zzzzz");
    expect(state.pending).toBe(false);
    expect(state.message.text).toBe("Not in word list");
  });

  test("the server's colors are applied, and the answer arrives when the round ends", () => {
    let state = gameReducer(guess(board(), "about"), {
      type: "GUESS_RESULT",
      result: ["almost", "error", "error", "error", "error"],
    });
    expect(state).toMatchObject({ pending: false, attempt: 1, status: "playing", answer: "" });

    state = gameReducer(guess(state, "crane"), {
      type: "GUESS_RESULT",
      result: Array(5).fill("correct"),
      answer: "crane",
    });
    expect(state).toMatchObject({ status: "won", answer: "crane", justFinished: true });
  });

  test("a rejected guess unlocks input and explains why", () => {
    const state = gameReducer(guess(board(), "about"), { type: "GUESS_FAILED", message: "This board has closed" });
    expect(state.pending).toBe(false);
    expect(state.attempt).toBe(0);
    expect(state.message).toMatchObject({ text: "This board has closed", shake: true });
  });

  test("resuming replays rows the server already scored", () => {
    const state = gameReducer(loaded(), {
      type: "START",
      mode: "board",
      boardId: "b1",
      rows: [{ word: "about", result: ["almost", "error", "error", "error", "error"] }],
    });
    expect(state.board[0].join("")).toBe("ABOUT");
    expect(state).toMatchObject({ attempt: 1, status: "playing", justFinished: false });
  });
});
