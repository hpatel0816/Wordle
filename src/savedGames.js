import { MAX_GUESSES, getDailyAnswer, getDayNumber, pickAnswer } from "./gameLogic";
import { readPreference, writePreference } from "./storage";

// Each mode keeps its own round in localStorage, so a reload or a switch
// between Daily and Unlimited picks up where the player left off.
const key = (mode) => `game:${mode}`;

export function saveGame(state) {
  // Only solo rounds are saved: challenges come from the URL, online games
  // live on the server, and practice duels are short.
  if (state.status === "loading" || !["daily", "unlimited"].includes(state.mode)) return;
  writePreference(key(state.mode), {
    answer: state.answer,
    day: state.day,
    hardMode: state.hardMode,
    guesses: state.board.slice(0, state.attempt).map((row) => row.join("").toLowerCase()),
  });
}

function isUnfinished(saved) {
  return saved.guesses.length < MAX_GUESSES && !saved.guesses.includes(saved.answer);
}

// START fields for a round in `mode`, resuming a saved one where possible.
// hardMode applies to fresh rounds; resumed rounds keep their own setting.
export function roundFor(mode, answers, hardMode, now = new Date()) {
  if (mode === "daily") {
    const day = getDayNumber(now);
    const saved = readPreference(key("daily"), null);
    const resumed = saved?.day === day && saved.guesses?.length > 0;
    return {
      mode,
      day,
      answer: getDailyAnswer(answers, day),
      guesses: resumed ? saved.guesses : [],
      hardMode: resumed ? saved.hardMode : hardMode,
    };
  }

  const saved = readPreference(key("unlimited"), null);
  if (saved?.guesses && answers.includes(saved.answer) && isUnfinished(saved)) {
    return {
      mode: "unlimited",
      answer: saved.answer,
      guesses: saved.guesses,
      hardMode: saved.guesses.length > 0 ? saved.hardMode : hardMode,
    };
  }
  return { mode: "unlimited", answer: pickAnswer(answers), hardMode };
}
