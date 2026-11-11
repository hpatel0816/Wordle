# WeWordle

A browser word game built with React, made for playing with friends. Guess the hidden five-letter word in six tries. After each guess the tiles show how close you were. Play unlimited rounds, take on the daily puzzle, or send a friend a word to guess.

**Friend boards** are the first multiplayer feature: share a link, everyone plays the same hidden word, and you compare results on a scoreboard. Live duels and ranked play come next (see [`docs/MULTIPLAYER_PLAN.md`](docs/MULTIPLAYER_PLAN.md)).

WeWordle is a personal project inspired by Wordle. It isn't affiliated with The New York Times, or with other games that use a similar name.

**Contributors:** Harsh Patel, Dhairya Prajapati, Radhe Patel

## How to play

- Type a five-letter word with your keyboard or the on-screen keys, then press **Enter**.
- 🟩 **Green**: the letter is in the word and in the right spot.
- 🟨 **Yellow**: the letter is in the word but in a different spot.
- ⬛ **Dark grey**: the letter isn't in the word. Ruled-out letters can't be typed again.
- Repeated letters are only colored as many times as they appear in the answer.

The top bar has **?** (rules), a bar chart (statistics) and a gear (settings).

## Features

- **Two modes.** *Unlimited* draws a random answer from the 1,500 most common words; press **Play Again** for another. *Daily #N* is one puzzle per day, the same for every player (a seeded shuffle of the answer pool indexed by the local date), with a countdown to the next one. All 5,757 words in the list are accepted as guesses.
- **Progress is saved.** Each mode's round is kept in `localStorage`, so a reload or a mode switch resumes where you left off.
- **Statistics and streaks.** Games played, win %, current and max streak, and a guess distribution chart, tracked separately for Daily (wins on consecutive days) and Unlimited (wins in a row).
- **Share your result.** A spoiler-free emoji grid (`WeWordle Daily #42 4/6*`) copied to the clipboard, or sent through the share sheet on phones.
- **Challenge a friend.** Pick any valid word and send a link (`/?challenge=…`); the word is scrambled in the URL. Challenge rounds don't affect your stats.
- **Hard mode.** Revealed hints must be used in later guesses. It can be changed only at the start of a round, and shared results mark it with `*`.
- **Light and dark themes** (defaulting to the system setting) and an orange/blue **color-blind palette**, all in Settings.
- Keyboard keys turn green, yellow or grey as you learn about each letter.
- In-app messages ("Not in word list", "Not enough letters") with a row shake, instead of browser pop-ups.
- Works on phones: square tiles and a keyboard that resize to the screen.
- Accessible: colors meet WCAG AA contrast, keys are real buttons with screen-reader labels, dialogs trap focus, and each scored guess is announced.
- A How To Play dialog that opens on your first visit.

## Online play (friend boards)

Online play uses [Supabase](https://supabase.com). Without it configured, the app is solo-only and the Friends button is hidden.

**Run it locally** (needs Docker running):

```bash
npm run db:start      # starts Postgres, Auth and the API in Docker; prints the local URL and keys
cp .env.example .env.local
```

Put the local `API_URL` and `ANON_KEY` (from `npx supabase status`) into `.env.local`, then run `npm run dev`. Supabase Studio, a browser UI for the database, is at <http://127.0.0.1:54323>.

| Command | What it does |
|---|---|
| `npm run db:start` / `db:stop` | Start or stop the local Supabase stack |
| `npm run db:reset` | Rebuild the local database from `supabase/migrations` |
| `npm run db:test` | Run the database tests in `supabase/tests` |
| `npm run db:words` | Regenerate the word-list migration after editing `Word-Bank.txt` |

**How it stays fair.** The answer never reaches the browser. Players can't read the tables directly. Guesses go to database functions that return only the colors, and the answer and other players' words are revealed only after you finish. See `supabase/migrations/` and the tests in `supabase/tests/`.

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
supabase/               Local Supabase config, SQL migrations and database tests
scripts/                generate-words-migration.mjs
public/                 Icons, manifest, robots.txt
src/
  main.jsx              Mounts <App />
  App.jsx               Layout, word-list loading, physical keyboard, settings, stats recording
  gameState.js          gameReducer: all game rules (typing, submitting, hard mode, win/lose, START)
  gameLogic.js          Pure helpers: scoring, key colors, hard-mode checks, daily answer,
                        share text, challenge codes
  savedGames.js         Saves each mode's round and picks the round to start or resume
  stats.js              Statistics and streak calculations
  share.js              Share sheet / clipboard helper
  Words.js              Fetches Word-Bank.txt at runtime
  online/               Supabase client, API wrappers, and useFriendBoard (joining, server-scored guesses, scoreboard)
  storage.js            Safe localStorage read/write
  brand.js              The app name (APP_NAME)
  Word-Bank.txt         5,757 five-letter words, most common first, one per line (LF)
  AppParts/             UI components (Display, Keyboard, GameOver, ModeSwitch, Toast, and the
                        Help, Settings, Statistics and Challenge dialogs built on Modal)
  *.test.js(x)          Unit tests for the logic and reducer, plus App-level tests
```

The game state lives in one reducer (`src/gameState.js`) and is shared through React context as `{ state, dispatch }`. Components only dispatch actions such as `ADD_LETTER`, `SUBMIT` or `START`, so the rules can be unit-tested without rendering anything.

### Saved data

Everything is stored in the browser's `localStorage`; there is no server.

| Key | Contents |
|---|---|
| `game:daily`, `game:unlimited` | The current round per mode (answer, guesses, hard mode) |
| `stats:daily`, `stats:unlimited` | Statistics per mode |
| `mode`, `theme`, `highContrast`, `hardMode`, `seenHelp` | Settings |

Daily answers depend on the order of the answer pool. Changing `Word-Bank.txt`, `ANSWER_POOL_SIZE` or `ANSWER_EXCLUSIONS` changes which word falls on each day.

## Word list

`src/Word-Bank.txt` appears to be the Stanford GraphBase five-letter word list (ordered by frequency). Check its source and license before redistributing the project. `.gitattributes` keeps the file's line endings as LF on every OS.
