import { getKeyStatuses, parseWordList, pickAnswer, scoreGuess } from "./gameLogic";

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
