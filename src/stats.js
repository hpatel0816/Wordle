import { MAX_GUESSES } from "./gameLogic";
import { readPreference, writePreference } from "./storage";

// Stats are kept separately for Daily and Unlimited, since a daily streak
// means "days in a row" and an unlimited streak means "wins in a row".
export const STATS_MODES = ["daily", "unlimited"];

export function emptyStats() {
  return {
    played: 0,
    wins: 0,
    currentStreak: 0,
    maxStreak: 0,
    distribution: Array(MAX_GUESSES).fill(0), // wins by number of guesses
    lastDay: null, // daily only: the last puzzle number played
  };
}

// Add one finished round. `day` is set for daily puzzles: a daily streak
// only continues from yesterday's puzzle, and a day is never counted twice.
export function recordResult(stats, { won, attempts, day = null }) {
  if (day !== null && stats.lastDay !== null && day <= stats.lastDay) return stats;

  let currentStreak = 0;
  if (won) {
    const continues = day === null || stats.lastDay === day - 1;
    currentStreak = continues ? stats.currentStreak + 1 : 1;
  }

  const distribution = [...stats.distribution];
  if (won) distribution[attempts - 1] += 1;

  return {
    played: stats.played + 1,
    wins: stats.wins + (won ? 1 : 0),
    currentStreak,
    maxStreak: Math.max(stats.maxStreak, currentStreak),
    distribution,
    lastDay: day ?? stats.lastDay,
  };
}

// The streak to show today: a daily streak is broken once a day is missed.
export function visibleStreak(stats, today = null) {
  if (today !== null && stats.lastDay !== null && stats.lastDay < today - 1) return 0;
  return stats.currentStreak;
}

export function winPercent(stats) {
  return stats.played === 0 ? 0 : Math.round((stats.wins / stats.played) * 100);
}

export function loadStats(mode) {
  return { ...emptyStats(), ...readPreference(`stats:${mode}`, {}) };
}

export function saveStats(mode, stats) {
  writePreference(`stats:${mode}`, stats);
}
