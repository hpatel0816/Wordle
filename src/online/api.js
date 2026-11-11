import { onlineEnabled, supabase } from "./supabaseClient";

// Thin wrappers around the database functions in
// supabase/migrations/*_friend_boards.sql. Every call signs the player in
// as a guest first if needed. Errors are thrown with a message that can be
// shown to the player.

export { onlineEnabled };

async function ensureSession() {
  const { data } = await supabase.auth.getSession();
  if (data.session) return;
  const { error } = await supabase.auth.signInAnonymously();
  if (error) throw new Error("Couldn't sign in. Check your connection and try again.");
}

async function call(name, args) {
  if (!onlineEnabled) throw new Error("Online play isn't set up");
  try {
    await ensureSession();
  } catch (error) {
    throw new Error(error.message);
  }
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    // P0001 = a message raised on purpose by our functions.
    if (error.code === "P0001") throw new Error(error.message);
    throw new Error("Couldn't reach the server. Check your connection and try again.");
  }
  return data;
}

export const api = {
  getProfile: () => call("get_my_profile"),
  setDisplayName: (name) => call("set_display_name", { p_name: name }),
  createBoard: (hardMode) => call("create_match", { p_hard_mode: hardMode }),
  joinBoard: (id) => call("join_match", { p_match: id }),
  submitGuess: (id, word) => call("submit_guess", { p_match: id, p_guess: word }),
  getBoard: (id) => call("get_match", { p_match: id }),
};

export const BOARD_PARAM = "board";

export function boardUrl(id, location = window.location) {
  return `${location.origin}${location.pathname}?${BOARD_PARAM}=${id}`;
}
