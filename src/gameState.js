import { MAX_GUESSES, WORD_LENGTH, scoreGuess } from "./gameLogic";

export const emptyBoard = () =>
  Array.from({ length: MAX_GUESSES }, () => Array(WORD_LENGTH).fill(""));

export const initialState = {
  status: "loading", // "loading" | "playing" | "won" | "lost"
  words: [],
  wordSet: new Set(),
  answer: "",
  board: emptyBoard(), // uppercase letters, "" for empty tiles
  evaluations: [], // scoreGuess() result for each submitted row
  attempt: 0, // index of the row being typed
  letterPos: 0, // index of the next tile in that row
  message: null, // { text, id } for the latest user-facing message
};

function startGame(state, answer) {
  return {
    ...state,
    status: "playing",
    answer,
    board: emptyBoard(),
    evaluations: [],
    attempt: 0,
    letterPos: 0,
    message: null,
  };
}

function withMessage(state, text) {
  const id = (state.message?.id ?? 0) + 1;
  return { ...state, message: { text, id } };
}

function setTile(board, row, col, value) {
  return board.map((letters, r) =>
    r === row ? letters.map((l, c) => (c === col ? value : l)) : letters
  );
}

export function gameReducer(state, action) {
  switch (action.type) {
    case "LOADED":
      return startGame(
        { ...state, words: action.words, wordSet: new Set(action.words) },
        action.answer
      );

    case "NEW_GAME":
      return startGame(state, action.answer);

    case "ADD_LETTER": {
      if (state.status !== "playing" || state.letterPos >= WORD_LENGTH) return state;
      return {
        ...state,
        board: setTile(state.board, state.attempt, state.letterPos, action.letter.toUpperCase()),
        letterPos: state.letterPos + 1,
      };
    }

    case "DELETE_LETTER": {
      if (state.status !== "playing" || state.letterPos === 0) return state;
      return {
        ...state,
        board: setTile(state.board, state.attempt, state.letterPos - 1, ""),
        letterPos: state.letterPos - 1,
      };
    }

    case "SUBMIT": {
      if (state.status !== "playing" || state.letterPos < WORD_LENGTH) return state;

      const guess = state.board[state.attempt].join("").toLowerCase();
      if (!state.wordSet.has(guess)) return withMessage(state, "Word Not Found");

      const attempt = state.attempt + 1;
      let status = "playing";
      if (guess === state.answer) status = "won";
      else if (attempt >= MAX_GUESSES) status = "lost";

      return {
        ...state,
        evaluations: [...state.evaluations, scoreGuess(guess, state.answer)],
        attempt,
        letterPos: 0,
        status,
      };
    }

    default:
      return state;
  }
}
