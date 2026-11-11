import fs from "fs";
import path from "path";
import {
  ANSWER_POOL_SIZE,
  getAnswerPool,
  getDailyAnswer,
  getDayNumber,
  getHardModeError,
  getKeyStatuses,
  msUntilNextDay,
  parseWordList,
  pickAnswer,
  scoreGuess,
} from "./gameLogic";

describe("getAnswerPool", () => {
  const allWords = parseWordList(fs.readFileSync(path.join(__dirname, "Word-Bank.txt"), "utf8"));
  const pool = getAnswerPool(allWords);

  test("uses only the most common words", () => {
    expect(allWords.length).toBeGreaterThan(5000);
    expect(pool.length).toBeLessThanOrEqual(ANSWER_POOL_SIZE);
    expect(pool.length).toBeGreaterThan(ANSWER_POOL_SIZE - 10);
    expect(pool).toContain("about");
    expect(pool).not.toContain(allWords[allWords.length - 1]);
  });

  test("leaves out excluded words but keeps them as valid guesses", () => {
    expect(pool).not.toContain("slave");
    expect(pool).not.toContain("queer");
    expect(allWords).toContain("slave");
  });
});

describe("getKeyStatuses", () => {
  test("keeps the best status seen for each letter", () => {
    const board = [["E", "E", "R", "I", "E"], ["C", "R", "A", "N", "E"]];
    const evaluations = [scoreGuess("eerie", "crane"), scoreGuess("crane", "crane")];
    const statuses = getKeyStatuses(board, evaluations);
    expect(statuses).toMatchObject({ E: "correct", R: "correct", I: "error", C: "correct" });
  });

  test("a letter only ends up as error when it is not in the answer", () => {
    const board = [["E", "E", "R", "I", "E"]];
    expect(getKeyStatuses(board, [scoreGuess("eerie", "theme")])).toEqual({
      E: "correct",
      R: "error",
      I: "error",
    });
  });
});

test("pickAnswer uses the random source to choose a word", () => {
  expect(pickAnswer(["a", "b", "c", "d"], () => 0.5)).toBe("c");
});

describe("parseWordList", () => {
  test("splits LF line endings", () => {
    expect(parseWordList("which\nthere\ntheir\n")).toEqual(["which", "there", "their"]);
  });

  test("splits CRLF line endings", () => {
    expect(parseWordList("which\r\nthere\r\n")).toEqual(["which", "there"]);
  });

  test("trims, lowercases, and drops blank lines", () => {
    expect(parseWordList(" ABOUT \n\nOther\r\n")).toEqual(["about", "other"]);
  });
});

describe("scoreGuess", () => {
  test("all correct", () => {
    expect(scoreGuess("crane", "crane")).toEqual(Array(5).fill("correct"));
  });

  test("no letters in common", () => {
    expect(scoreGuess("dumpy", "crane")).toEqual(Array(5).fill("error"));
  });

  test("letters in the wrong spot are almost", () => {
    expect(scoreGuess("nacre", "crane")).toEqual(["almost", "almost", "almost", "almost", "correct"]);
  });

  test("is case-insensitive", () => {
    expect(scoreGuess("CRANE", "crane")).toEqual(Array(5).fill("correct"));
  });

  test("extra copies of a letter beyond the answer's count are errors", () => {
    // THEME has two E's (index 2 and 4). EERIE's E@4 is exact, E@0 takes
    // the other E as almost, and E@1 has no copies left, so it is an error.
    expect(scoreGuess("eerie", "theme")).toEqual(["almost", "error", "error", "error", "correct"]);
  });

  test("exact matches take priority over earlier almost matches", () => {
    // Answer has one L, at index 4; guess has L at 0 and 4.
    expect(scoreGuess("label", "hotel")).toEqual(["error", "error", "error", "correct", "correct"]);
  });

  test("a single answer letter only marks one guessed copy as almost", () => {
    expect(scoreGuess("geese", "those")).toEqual(["error", "error", "error", "correct", "correct"]);
    // CRANE's only E is matched exactly at index 4, so earlier E's are errors.
    expect(scoreGuess("eerie", "crane")).toEqual(["error", "error", "almost", "error", "correct"]);
  });
});

describe("getHardModeError", () => {
  const rows = (answer, ...guesses) => ({
    board: guesses.map((g) => [...g.toUpperCase()]),
    evaluations: guesses.map((g) => scoreGuess(g, answer)),
  });

  test("green letters must stay in place", () => {
    const { board, evaluations } = rows("crane", "cloth");
    expect(getHardModeError("about", board, evaluations)).toBe("1st letter must be C");
    expect(getHardModeError("cabin", board, evaluations)).toBeNull();
  });

  test("yellow letters must be used somewhere", () => {
    const { board, evaluations } = rows("crane", "about");
    expect(getHardModeError("cloth", board, evaluations)).toBe("Guess must contain A");
    expect(getHardModeError("cabin", board, evaluations)).toBeNull();
  });

  test("repeated hints need as many copies as were revealed", () => {
    // THEME vs EERIE reveals two E's (one green at the end, one yellow).
    const { board, evaluations } = rows("theme", "eerie");
    expect(getHardModeError("those", board, evaluations)).toBe("Guess must contain 2 Es");
    expect(getHardModeError("there", board, evaluations)).toBeNull();
  });

  test("anything goes before the first guess", () => {
    expect(getHardModeError("zzzzz", [], [])).toBeNull();
  });
});

describe("daily puzzle", () => {
  test("day numbers follow the local calendar", () => {
    expect(getDayNumber(new Date(2025, 0, 1, 0, 0))).toBe(0);
    expect(getDayNumber(new Date(2025, 0, 1, 23, 59))).toBe(0);
    expect(getDayNumber(new Date(2025, 0, 2, 0, 1))).toBe(1);
    expect(getDayNumber(new Date(2026, 0, 1, 12))).toBe(365);
  });

  test("time until the next puzzle counts down to local midnight", () => {
    expect(msUntilNextDay(new Date(2025, 5, 10, 23, 0, 0))).toBe(60 * 60 * 1000);
  });

  test("everyone gets the same answer for a day and words don't repeat for a long time", () => {
    const answers = Array.from({ length: 50 }, (_, i) => `w${i}`);
    expect(getDailyAnswer(answers, 3)).toBe(getDailyAnswer([...answers], 3));
    const fifty = new Set(Array.from({ length: 50 }, (_, day) => getDailyAnswer(answers, day)));
    expect(fifty.size).toBe(50);
    expect(getDailyAnswer(answers, 50)).toBe(getDailyAnswer(answers, 0));
  });
});
