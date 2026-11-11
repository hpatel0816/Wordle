# WeWordle multiplayer plan

Status: stage 2 (friend boards) built and running against local Supabase, 2026-11-11. Backend: **Supabase** (Postgres, Auth, Realtime).

The solo game (Unlimited, Daily, challenge links) stays as it is. Multiplayer is added in three stages, and each stage can ship on its own.

| Stage | What players get | Needs enough players online at once? |
|---|---|---|
| 2. Friend boards | Share a link; everyone with it plays the same hidden word whenever they like and sees a shared scoreboard afterwards | No |
| 3. Live duels | A private room: two or more friends start together and race on the same word, seeing each other's progress live | No (friends arrive together) |
| 4. Ranked play | Play random opponents, with a skill rating and a computer opponent when nobody is around | Yes |

(Stage 1 was the WeWordle rebrand.)

## The one rule: the answer never reaches the browser

Today the answer lives in the browser, which is fine for solo play. In multiplayer, anyone could read it in the developer tools. So for online rounds:

- The answer is stored only in the database, in a column that players can't read.
- Each guess is sent to a database function that checks it and returns only the colors.
- The answer is revealed to a player only once their own round is over.
- Other players' guessed words stay hidden until the match ends. During a match you see only their colors, as on the official share grid.

The current challenge links put the (scrambled) answer in the URL. Friend boards replace them for online play. The old links can stay for offline sharing.

## Accounts

- **Guest sign-in** using Supabase anonymous auth. No email is needed; a player picks a display name the first time they play online.
- Display names are checked against a blocklist and a length limit, and can be reported.
- Later: let a guest attach an email or Google sign-in so their history follows them to another device.

## Database (first draft)

```
profiles      id (= auth user id), display_name, rating (default 1000), created_at
words         word (pk), is_answer (bool)        -- loaded from Word-Bank.txt
matches       id, kind ('board' | 'duel' | 'ranked'), status ('waiting' | 'active' | 'finished'),
              answer (hidden), hard_mode, created_by, created_at, starts_at, ends_at
match_players match_id, user_id, joined_at, finished_at, solved, guesses_used
guesses       match_id, user_id, row, word (hidden from others until the match ends),
              result text[] (the colors), created_at
```

Players never read or write these tables directly. Row-level security denies all direct access, and the app calls a small set of `security definer` functions instead:

| Function | Does |
|---|---|
| `create_match(kind, hard_mode)` | Picks a random answer on the server and returns the match id |
| `join_match(match_id)` | Adds the player, if the match is open |
| `submit_guess(match_id, word)` | Checks the word list and hard-mode rules, scores the guess with the same two-pass rules as `scoreGuess`, stores it, updates the player's result and returns the colors. Ends the match when everyone is done or time is up |
| `get_match(match_id)` | Returns the board for the caller: their own letters and colors, other players' colors only, and every word and the answer once the match has ended |

Scoring in SQL duplicates `scoreGuess` from `src/gameLogic.js`. A shared set of test cases (the existing `scoreGuess` tests turned into a fixture) is run against both.

### Live updates (stage 3)

- Supabase Realtime **Broadcast** on a channel per match (`match:<id>`). After storing a guess, `submit_guess` sends a "player X filled row N with these colors" event. The payload never contains the letters.
- Realtime **Presence** shows who is in the lobby.
- The server time (`starts_at`) starts the race, so a slow phone doesn't lose seconds.
- Check the current Supabase docs for broadcasting from database functions before building this. That API is newer than the rest.

## Game rules for each stage

**Friend boards (stage 2)**
- Anyone with the link `/play/<match id>` can join. The board stays open for 7 days.
- Each player plays at their own pace. When they finish they see the scoreboard: name, solved or not, guesses used, time taken, and their color grid.
- The ranking is solved before unsolved, then fewer guesses, then faster time.

**Live duels (stage 3)**
- One player creates a room and shares the link. Others join a lobby, and the host presses Start.
- Everyone gets the same word. The first to solve wins, with fewer guesses as the tiebreak. There's a 5-minute limit (to decide).
- Opponents' rows show colors only, live.

**Ranked (stage 4)**
- A queue table and a `join_queue()` function pair the two longest-waiting players (`for update skip locked`, so two requests can't take the same opponent).
- After 20 seconds with no match, offer a computer opponent that "solves" with a realistic number of guesses and timing.
- An Elo rating is updated when a ranked match ends. Show it on the profile and a leaderboard.

## Changes to the app

- `src/online/supabaseClient.js`: the client, configured from `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`, which is not committed. The anon key is public by design; the security comes from the rules above.
- `src/online/api.js`: thin wrappers around the database functions, mocked in tests.
- **Reducer.** Online rounds can't score locally. A new `mode: "online"` sends the guess and waits: `SUBMIT` → `GUESS_PENDING` (input locked, row shows a spinner) → `GUESS_RESULT { result }` or `GUESS_FAILED { message }`. Typing, deleting, the word-list check and the hard-mode check stay local for instant feedback; the server checks again.
- **New screens:** a Play Online menu (create board, create duel, join with a link, later Find opponent), a lobby, the scoreboard, and opponents' mini-boards beside the main board.
- **Routing.** A small router (or a `?match=` parameter, matching how challenge links work today) for `/play/<id>`.
- **Offline.** Solo modes keep working with no connection. Online screens show a clear "can't reach the server" state.

## Development setup

- Supabase CLI with local Postgres in Docker (`supabase start`), so development and tests don't touch the hosted project.
- SQL migrations in `supabase/migrations/`, committed to the repo.
- Database tests for the functions and security rules, for example "a player can't read the answer" and "a guess after the match ended is rejected".
- The frontend can stay a static site (Vercel, Netlify or GitHub Pages).

## Needed from the team before going online

Stage 2 runs locally today (see the README). To put it on the internet:

1. Create a Supabase project (free tier) and turn on **anonymous sign-ins** under Authentication.
2. Share the project URL and anon key for `.env.local`. Never share the `service_role` key, and never commit it.
3. Install Docker and the Supabase CLI for local development.
4. Check the free tier's current limits. Inactive free projects may be paused.

## Open questions

- Time limit for live duels, and whether boards should expire sooner or later than 7 days.
- Should hard mode be a room setting chosen by the host?
- Do friend boards need a cap on players?
- Which display-name blocklist to use, and who reviews reports?
