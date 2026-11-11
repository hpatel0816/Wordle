import fs from "fs";
import path from "path";
import { botCandidates, planBotGame } from "./bot";
import { getAnswerPool, parseWordList, scoreGuess } from "./gameLogic";

const answers = getAnswerPool(parseWordList(fs.readFileSync(path.join(__dirname, "Word-Bank.txt"), "utf8")));

// Small deterministic PRNG for repeatable plans.
function seeded(seed) {
  return () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
}

test("candidates fit every clue", () => {
  const history = [{ word: "slate", result: scoreGuess("slate", "crane") }];
  const candidates = botCandidates(answers, history);
  expect(candidates).toContain("crane");
  expect(candidates.every((w) => scoreGuess("slate", w).join() === history[0].result.join())).toBe(true);
});

test("a focused bot always solves within six guesses, with pauses between guesses", () => {
  for (let seed = 1; seed <= 25; seed++) {
    const answer = answers[(seed * 37) % answers.length];
    const moves = planBotGame(answer, answers, { random: seeded(seed), focus: 1 });
    expect(moves.at(-1).word).toBe(answer);
    expect(moves.length).toBeLessThanOrEqual(6);
    moves.forEach((move, i) => {
      expect(move.result).toEqual(scoreGuess(move.word, answer));
      const gap = move.at - (i ? moves[i - 1].at : 0);
      expect(gap).toBeGreaterThanOrEqual(7000);
      expect(gap).toBeLessThanOrEqual(16000);
    });
  }
});

test("a less focused bot can fail, and never plays more than six guesses", () => {
  const moves = planBotGame("crane", answers, { random: seeded(3), focus: 0 });
  expect(moves.length).toBeLessThanOrEqual(6);
});
