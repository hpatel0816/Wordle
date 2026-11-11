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
  answers: [], // words that can be picked as the answer
  wordSet: new Set(), // every valid guess
  answer: "",
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

// Each message gets a new id so repeating the same error still shows a
// toast and replays the row shake. Kept in state so the reducer stays pure.
function withMessage(state, text, { shake = false } = {}) {
  const id = state.messageCount + 1;
  return { ...state, messageCount: id, message: { text, id, shake } };
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
        { ...state, answers: action.answers, wordSet: new Set(action.words) },
        action.answer
      );

    case "NEW_GAME":
      return startGame(state, action.answer);

    case "ADD_LETTER": {
      if (state.status !== "playing" || state.letterPos >= WORD_LENGTH) return state;
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
      if (state.status !== "playing" || state.letterPos === 0) return state;
      return {
        ...state,
        board: setTile(state.board, state.attempt, state.letterPos - 1, ""),
        letterPos: state.letterPos - 1,
      };
    }

    case "SUBMIT": {
      if (state.status !== "playing") return state;
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

    case "SET_HARD_MODE":
      if (!canChangeHardMode(state)) {
        return withMessage(state, "Hard mode can only be changed at the start of a round");
      }
      return { ...state, hardMode: action.on };

    case "CLEAR_MESSAGE":
      // Only clear the message the caller saw, not a newer one.
      if (state.message?.id !== action.id) return state;
      return { ...state, message: null };

    default:
      return state;
  }
}
