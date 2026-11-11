import { emptyStats, recordResult, visibleStreak, winPercent } from "./stats";

const play = (results) => results.reduce(recordResult, emptyStats());

test("counts games, wins and the guess distribution", () => {
  const stats = play([
    { won: true, attempts: 3 },
    { won: false, attempts: 6 },
    { won: true, attempts: 3 },
    { won: true, attempts: 1 },
  ]);
  expect(stats).toMatchObject({ played: 4, wins: 3, currentStreak: 2, maxStreak: 2 });
  expect(stats.distribution).toEqual([1, 0, 2, 0, 0, 0]);
  expect(winPercent(stats)).toBe(75);
});

test("a loss resets the current streak but keeps the best one", () => {
  const stats = play([{ won: true, attempts: 2 }, { won: true, attempts: 2 }, { won: false, attempts: 6 }]);
  expect(stats.currentStreak).toBe(0);
  expect(stats.maxStreak).toBe(2);
});

test("a daily streak only continues from the previous day", () => {
  const stats = play([
    { won: true, attempts: 4, day: 10 },
    { won: true, attempts: 4, day: 11 },
    { won: true, attempts: 4, day: 13 },
  ]);
  expect(stats.currentStreak).toBe(1);
  expect(stats.maxStreak).toBe(2);
});

test("the same daily puzzle is never counted twice", () => {
  const once = play([{ won: true, attempts: 4, day: 10 }]);
  expect(recordResult(once, { won: true, attempts: 4, day: 10 })).toBe(once);
});

test("a missed day shows the daily streak as broken", () => {
  const stats = play([{ won: true, attempts: 4, day: 10 }]);
  expect(visibleStreak(stats, 11)).toBe(1);
  expect(visibleStreak(stats, 12)).toBe(0);
  expect(visibleStreak(stats)).toBe(1);
});

test("win percentage is 0 before any games", () => {
  expect(winPercent(emptyStats())).toBe(0);
});
