# Wordle

A browser word game built with React. Guess the hidden five-letter word in six tries. After each guess the tiles show how close you were. There's no daily limit: press **Play Again** for a new word whenever you like.

**Contributors:** Harsh Patel, Dhairya Prajapati, Radhe Patel

## How to play

- Type a five-letter word with your keyboard or the on-screen keys, then press **Enter**.
- 🟩 **Green**: the letter is in the word and in the right spot.
- 🟨 **Yellow**: the letter is in the word but in a different spot.
- ⬛ **Dark grey**: the letter isn't in the word. Ruled-out letters can't be typed again.
- Repeated letters are only colored as many times as they appear in the answer.

Press **?** in the top bar for the rules at any time, and **◐** for a high-contrast (orange/blue) palette.

## Features

- Unlimited rounds with a random answer drawn from the 1,500 most common words. All 5,757 words in the list are accepted as guesses.
- Keyboard keys turn green, yellow or grey as you learn about each letter.
- In-app messages ("Not in word list", "Not enough letters") with a row shake, instead of browser pop-ups.
- Works on phones: square tiles and a keyboard that resize to the screen.
- Accessible: colors meet WCAG AA contrast, keys are real buttons with screen-reader labels, and each scored guess is announced.
- A How To Play dialog that opens on your first visit.

## Getting started

Requires Node.js 18 or newer.

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>.

| Command | What it does |
|---|---|
| `npm run dev` (or `npm start`) | Start the Vite dev server on port 3000 with hot reload |
| `npm test` | Run the test suite once with Vitest |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Lint with ESLint |
| `npm run build` | Build for production into `dist/` |
| `npm run preview` | Serve the production build locally |

## Project structure

```
index.html              Page shell (Vite entry)
public/                 Icons, manifest, robots.txt
src/
  main.jsx              Mounts <App />
  App.jsx               Layout, word-list loading, physical keyboard, settings
  gameState.js          gameReducer: all game rules (typing, submitting, win/lose, new game)
  gameLogic.js          Pure helpers: scoreGuess, getKeyStatuses, getAnswerPool, parseWordList
  Words.js              Fetches Word-Bank.txt at runtime
  storage.js            Safe localStorage read/write for preferences
  Word-Bank.txt         5,757 five-letter words, most common first, one per line (LF)
  AppParts/             UI components (Display, Letter, Keyboard, Key, GameOver, Toast, HelpModal)
  *.test.js(x)          Unit tests for the logic and reducer, plus App-level tests
```

The game state lives in one reducer (`src/gameState.js`) and is shared through React context as `{ state, dispatch }`. Components only dispatch actions such as `ADD_LETTER`, `SUBMIT` or `NEW_GAME`, so the rules can be unit-tested without rendering anything.

## Word list

`src/Word-Bank.txt` appears to be the Stanford GraphBase five-letter word list (ordered by frequency). Check its source and license before redistributing the project. `.gitattributes` keeps the file's line endings as LF on every OS.
