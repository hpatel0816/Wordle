import { MAX_GUESSES, scoreGuess } from "./gameLogic";

// The computer opponent ("WeBot") for unranked practice duels. It plays
// like a decent human: usually a guess that fits every clue so far, now and
// then a looser guess, with a pause of several seconds between guesses.

export const BOT_NAME = "WeBot";

const OPENERS = ["slate", "crane", "trace", "crate", "stare", "raise", "arise", "least"];

// Answers that match every clue the bot has seen.
export function botCandidates(answers, history) {
  return answers.filter((word) =>
    history.every((h) => scoreGuess(h.word, word).join() === h.result.join())
  );
}

const pick = (list, random) => list[Math.floor(random() * list.length)];

// The bot's whole game, decided up front: [{ word, result, at }] where `at`
// is milliseconds after the start. Ends at the solve or after 6 guesses.
export function planBotGame(
  answer,
  answers,
  { random = Math.random, minDelay = 7000, maxDelay = 16000, focus = 0.75 } = {}
) {
  const moves = [];
  const history = [];
  const openers = OPENERS.filter((w) => answers.includes(w));
  let at = 0;

  for (let i = 0; i < MAX_GUESSES; i++) {
    let word;
    if (i === 0 && openers.length) word = pick(openers, random);
    else if (random() < focus) word = pick(botCandidates(answers, history), random);
    else word = pick(answers, random);

    at += minDelay + random() * (maxDelay - minDelay);
    const result = scoreGuess(word, answer);
    moves.push({ word, result, at: Math.round(at) });
    history.push({ word, result });
    if (word === answer) break;
  }
  return moves;
}
