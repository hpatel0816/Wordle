import {
  MAX_GUESSES,
  WORD_LENGTH,
  getHardModeError,
  getKeyStatuses,
  scoreGuess,
} from "./gameLogic";

export const emptyBoard = () =>
  Array.from({ length: MAX_GUESSES }, () => Array(WORD_LENGTH).fill(""));

export const initialState = {
  status: "loading", // "loading" | "playing" | "won" | "lost"
  mode: "unlimited", // "unlimited" | "daily" | "challenge" | "board"
  boardId: null, // friend board id when mode is "board"
  pending: false, // board mode: waiting for the server to score a guess
  day: null, // daily puzzle number when mode is "daily"
  gameId: 0, // increases with every new round
  justFinished: false, // true when the latest guess ended the round (not a replay)
  answers: [], // words that can be picked as the answer
  wordSet: new Set(), // every valid guess
  answer: "", // "" in board mode until the round ends (the server keeps it)
  board: emptyBoard(), // uppercase letters, "" for empty tiles
  evaluations: [], // scoreGuess() result for each submitted row
  attempt: 0, // index of the row being typed
  letterPos: 0, // index of the next tile in that row
  message: null, // { text, id, shake } for the latest user-facing message
  messageCount: 0,
  hardMode: false, // revealed hints must be used in later guesses
};

// Hard mode can only be switched before the first guess or after a round.
export function canChangeHardMode(state) {
  return state.status !== "playing" || state.attempt === 0;
}

// Start a round. `guesses` replays words already played (e.g. a saved
// daily puzzle) without validating them again; `rows` replays guesses the
// server already scored ({ word, result }), for friend boards.
function startGame(
  state,
  { answer = "", mode = "unlimited", day = null, boardId = null, guesses = [], rows = [], hardMode }
) {
  let next = {
    ...state,
    status: "playing",
    mode,
    day,
    boardId,
    pending: false,
    answer,
    board: emptyBoard(),
    evaluations: [],
    attempt: 0,
    letterPos: 0,
    message: null,
    gameId: state.gameId + 1,
    hardMode: hardMode ?? state.hardMode,
  };
  for (const word of guesses) {
    if (next.status !== "playing") break;
    next = scoreRow({ ...next, board: setTile(next.board, next.attempt, null, word) }, word);
  }
  for (const { word, result } of rows) {
    if (next.status !== "playing") break;
    next = applyResult({ ...next, board: setTile(next.board, next.attempt, null, word) }, result);
  }
  return { ...next, justFinished: false };
}

// Score the current row locally and move on.
function scoreRow(state, guess) {
  return applyResult(state, scoreGuess(guess, state.answer));
}

// Record the colors for the current row, then move to the next row or end
// the round.
function applyResult(state, result) {
  const attempt = state.attempt + 1;
  let status = "playing";
  if (result.every((s) => s === "correct")) status = "won";
  else if (attempt >= MAX_GUESSES) status = "lost";
  return {
    ...state,
    evaluations: [...state.evaluations, result],
    attempt,
    letterPos: 0,
    status,
    pending: false,
    justFinished: status !== "playing",
  };
}

// Each message gets a new id so repeating the same error still shows a
// toast and replays the row shake. Kept in state so the reducer stays pure.
function withMessage(state, text, { shake = false } = {}) {
  const id = state.messageCount + 1;
  return { ...state, messageCount: id, message: { text, id, shake } };
}

// Set one tile, or a whole row from a word when col is null.
function setTile(board, row, col, value) {
  return board.map((letters, r) => {
    if (r !== row) return letters;
    if (col === null) return [...value.toUpperCase()];
    return letters.map((l, c) => (c === col ? value : l));
  });
}

export function gameReducer(state, action) {
  switch (action.type) {
    // { words, answers } plus the first round's START fields.
    case "LOADED":
      return startGame(
        { ...state, answers: action.answers, wordSet: new Set(action.words) },
        action
      );

    // { answer, mode?, day?, guesses?, hardMode? }
    case "START":
    case "NEW_GAME":
      return startGame(state, action);

    case "ADD_LETTER": {
      if (state.status !== "playing" || state.pending || state.letterPos >= WORD_LENGTH) return state;
      const letter = action.letter.toUpperCase();
      // Letters already ruled out can't be typed again; say why instead.
      if (getKeyStatuses(state.board, state.evaluations)[letter] === "error") {
        return withMessage(state, `${letter} is not in the word`);
      }
      return {
        ...state,
        board: setTile(state.board, state.attempt, state.letterPos, letter),
        letterPos: state.letterPos + 1,
      };
    }

    case "DELETE_LETTER": {
      if (state.status !== "playing" || state.pending || state.letterPos === 0) return state;
      return {
        ...state,
        board: setTile(state.board, state.attempt, state.letterPos - 1, ""),
        letterPos: state.letterPos - 1,
      };
    }

    case "SUBMIT": {
      if (state.status !== "playing" || state.pending) return state;
      if (state.letterPos < WORD_LENGTH) {
        return withMessage(state, "Not enough letters", { shake: true });
      }

      const guess = state.board[state.attempt].join("").toLowerCase();
      if (!state.wordSet.has(guess)) {
        return withMessage(state, "Not in word list", { shake: true });
      }

      if (state.hardMode) {
        const error = getHardModeError(guess, state.board, state.evaluations);
        if (error) return withMessage(state, error, { shake: true });
      }

      // Friend boards are scored by the server (the answer isn't here):
      // the caller sends the guess and replies with GUESS_RESULT.
      if (state.mode === "board") return { ...state, pending: true };

      return scoreRow(state, guess);
    }

    // { result, answer? } from the server for the pending board guess.
    case "GUESS_RESULT": {
      if (!state.pending) return state;
      const next = applyResult(state, action.result);
      return { ...next, answer: action.answer ?? state.answer };
    }

    // { message } when the server rejected the pending guess.
    case "GUESS_FAILED":
      if (!state.pending) return state;
      return withMessage({ ...state, pending: false }, action.message, { shake: true });

    // A finished round keeps the setting it was played with; the new
    // setting applies from the next round (passed in START by the caller).
    case "SET_HARD_MODE":
      if (!canChangeHardMode(state)) {
        return withMessage(state, "Hard mode can only be changed at the start of a round");
      }
      if (state.status !== "playing") return state;
      return { ...state, hardMode: action.on };

    case "SHOW_MESSAGE":
      return withMessage(state, action.text);

    case "CLEAR_MESSAGE":
      // Only clear the message the caller saw, not a newer one.
      if (state.message?.id !== action.id) return state;
      return { ...state, message: null };

    default:
      return state;
  }
}
