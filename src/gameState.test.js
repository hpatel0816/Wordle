import { gameReducer, initialState } from "./gameState";

const WORDS = ["crane", "about", "other", "which", "there", "their", "would"];

function loaded(answer = "crane") {
  return gameReducer(initialState, { type: "LOADED", words: WORDS, answer });
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

test("submitting an incomplete row does nothing", () => {
  const state = type(loaded(), "abo");
  expect(gameReducer(state, { type: "SUBMIT" })).toBe(state);
});

test("an unknown word sets a message and keeps the row", () => {
  const state = guess(loaded(), "zzzzz");
  expect(state.message.text).toBe("Word Not Found");
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
  ["about", "other", "which", "there", "their"].forEach((w) => (state = guess(state, w)));
  expect(state.status).toBe("playing");
  state = guess(state, "would");
  expect(state.status).toBe("lost");
});

test("NEW_GAME resets the board with a new answer and keeps the word list", () => {
  const finished = guess(loaded(), "crane");
  const next = gameReducer(finished, { type: "NEW_GAME", answer: "about" });
  expect(next.status).toBe("playing");
  expect(next.answer).toBe("about");
  expect(next.attempt).toBe(0);
  expect(next.evaluations).toEqual([]);
  expect(next.board.flat().every((l) => l === "")).toBe(true);
  expect(next.wordSet.has("crane")).toBe(true);
});
