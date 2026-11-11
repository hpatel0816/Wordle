import { useCallback, useEffect, useMemo, useState } from "react";
import { BOT_NAME, planBotGame } from "./bot";
import { MAX_GUESSES, pickAnswer } from "./gameLogic";

const COUNTDOWN_MS = 3000;
const BOT_DUEL_MS = 3 * 60 * 1000;

const iso = (ms) => new Date(ms).toISOString();

// A practice duel against the computer, run entirely in the browser (it's
// unranked, so the answer being local doesn't matter). Exposes `match` in
// the same shape as the server's get_match, so the duel screens work as-is.
export function useBotGame({ state, dispatch, playerName }) {
  const [plan, setPlan] = useState(null); // { gameId, moves, startsAt, endsAt }
  const [revealed, setRevealed] = useState(0); // bot moves shown so far
  const [finishedAt, setFinishedAt] = useState(null);

  const active = state.mode === "bot" && plan?.gameId === state.gameId ? plan : null;
  const over = state.status === "won" || state.status === "lost";

  const start = useCallback(
    (hardMode) => {
      const answer = pickAnswer(state.answers);
      const startsAt = Date.now() + COUNTDOWN_MS;
      setPlan({
        gameId: state.gameId + 1, // START bumps gameId
        moves: planBotGame(answer, state.answers),
        startsAt,
        endsAt: startsAt + BOT_DUEL_MS,
      });
      setRevealed(0);
      setFinishedAt(null);
      dispatch({ type: "START", mode: "bot", answer, waiting: true, hardMode });
    },
    [state.answers, state.gameId, dispatch]
  );

  // Countdown, the bot's guesses, and the time limit.
  useEffect(() => {
    if (!active || over) return;
    const timers = [];
    const at = (time, fn) => timers.push(setTimeout(fn, Math.max(0, time - Date.now())));
    at(active.startsAt, () => dispatch({ type: "BEGIN" }));
    active.moves.forEach((move, i) => {
      if (move.at > BOT_DUEL_MS) return;
      at(active.startsAt + move.at, () => {
        setRevealed((n) => Math.max(n, i + 1));
        if (move.word === state.answer) dispatch({ type: "MATCH_OVER", answer: state.answer });
      });
    });
    at(active.endsAt, () => dispatch({ type: "MATCH_OVER", answer: state.answer }));
    return () => timers.forEach(clearTimeout);
  }, [active, over, state.answer, dispatch]);

  // When the player runs out of guesses before time is up, the bot plays
  // out the rest of its game to settle who won.
  useEffect(() => {
    if (!active || !over) return;
    setFinishedAt((t) => t ?? Date.now());
    if (state.status === "lost" && Date.now() < active.endsAt) {
      setRevealed(active.moves.filter((m) => m.at <= BOT_DUEL_MS).length);
    }
  }, [active, over, state.status]);

  const match = useMemo(() => {
    if (!active) return null;
    const botMoves = active.moves.slice(0, revealed);
    const botSolved = botMoves.at(-1)?.word === state.answer;
    const won = state.status === "won";
    const winner = won ? playerName : botSolved ? BOT_NAME : null;
    const seconds = (ms) => Math.round(ms / 1000);

    const me = {
      name: playerName,
      is_me: true,
      is_winner: won,
      finished: over,
      solved: won,
      guesses_used: state.attempt,
      seconds: won && finishedAt ? seconds(finishedAt - active.startsAt) : null,
      rows: state.evaluations.map((result, r) => ({ word: state.board[r].join("").toLowerCase(), result })),
    };
    const bot = {
      name: BOT_NAME,
      is_me: false,
      is_winner: winner === BOT_NAME,
      finished: botSolved || revealed >= MAX_GUESSES,
      solved: botSolved,
      guesses_used: revealed,
      seconds: botSolved ? seconds(botMoves.at(-1).at) : null,
      rows: botMoves.map((m) => ({ word: over ? m.word : null, result: m.result })),
    };

    return {
      id: "bot",
      kind: "duel",
      bot: true,
      ranked: false,
      status: over ? "finished" : "active",
      starts_at: iso(active.startsAt),
      ends_at: iso(active.endsAt),
      winner,
      answer: over ? state.answer : null,
      hard_mode: state.hardMode,
      players: winner === BOT_NAME ? [bot, me] : [me, bot],
    };
  }, [active, revealed, finishedAt, over, playerName, state.answer, state.status, state.attempt, state.evaluations, state.board, state.hardMode]);

  return { match, start };
}
