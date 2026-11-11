import { useCallback, useEffect, useRef, useState } from "react";
import { BOARD_PARAM, api, onlineEnabled } from "./api";
import { ONLINE_MODES } from "../gameState";

const BOARD_REFRESH_MS = 15000;
// Realtime pings drive duels; polling is a fallback if the socket drops.
const DUEL_POLL_MS = 4000;

function setMatchInUrl(id) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set(BOARD_PARAM, id);
  else url.searchParams.delete(BOARD_PARAM);
  window.history.replaceState(null, "", url);
}

// Everything about online play that lives outside the reducer: the player's
// display name, creating and joining friend boards and live duels, sending
// pending guesses to the server, and keeping match data fresh.
export function useOnlineGame({ state, dispatch, openModal, closeModal }) {
  // undefined = not loaded yet, null = no display name chosen.
  const [profile, setProfile] = useState(undefined);
  const profileRef = useRef(profile);
  profileRef.current = profile;

  const [match, setMatch] = useState(null); // latest get_match() result
  const [invite, setInvite] = useState(null); // { id, creator, kind } waiting for a name

  // Server time minus local time, so countdowns agree across devices.
  const clockOffset = useRef(0);
  const serverNow = useCallback(() => Date.now() + clockOffset.current, []);

  const showError = useCallback(
    (error) => dispatch({ type: "SHOW_MESSAGE", text: error.message }),
    [dispatch]
  );

  // Store fresh match data and move a duel along (countdown over, ended).
  const applyMatch = useCallback(
    (data) => {
      setMatch(data);
      if (data.kind !== "duel") return;
      clockOffset.current = Date.parse(data.server_now) - Date.now();
      if (data.status === "finished") {
        dispatch({ type: "MATCH_OVER", answer: data.answer });
      } else if (data.status === "active" && Date.now() + clockOffset.current >= Date.parse(data.starts_at)) {
        dispatch({ type: "BEGIN" });
      }
    },
    [dispatch]
  );

  const refresh = useCallback(
    (id) => api.getBoard(id).then(applyMatch, () => {}), // keep the last data on errors
    [applyMatch]
  );

  const loadProfile = useCallback(async () => {
    if (profileRef.current !== undefined) return profileRef.current;
    const loaded = (await api.getProfile()) ?? null;
    profileRef.current = loaded;
    setProfile(loaded);
    return loaded;
  }, []);

  // Join a board or duel (asking for a name first if needed) and open it.
  const openMatch = useCallback(
    async (id) => {
      try {
        const preview = await api.getBoard(id);
        if (!(await loadProfile())) {
          setInvite({ id, creator: preview.creator, kind: preview.kind });
          openModal("friends");
          return;
        }
        await api.joinBoard(id);
        const data = await api.getBoard(id);
        const duel = data.kind === "duel";
        setMatchInUrl(id);
        dispatch({
          type: "START",
          mode: duel ? "duel" : "board",
          boardId: id,
          answer: data.answer ?? "",
          rows: data.my_rows,
          hardMode: data.hard_mode,
          waiting: duel,
        });
        applyMatch(data);
      } catch (error) {
        setMatchInUrl(null);
        showError(error);
      }
    },
    [dispatch, loadProfile, openModal, showError, applyMatch]
  );

  // Open a game from a ?board= link once the word list has loaded.
  const linkHandled = useRef(false);
  useEffect(() => {
    if (state.status === "loading" || linkHandled.current) return;
    linkHandled.current = true;
    const id = new URLSearchParams(window.location.search).get(BOARD_PARAM);
    if (!id) return;
    if (!onlineEnabled) {
      setMatchInUrl(null);
      dispatch({ type: "SHOW_MESSAGE", text: "Online play isn't set up on this site" });
      return;
    }
    openMatch(id);
  }, [state.status, openMatch, dispatch]);

  const saveName = useCallback(
    async (name) => {
      const saved = await api.setDisplayName(name);
      // Update the ref now: openMatch below runs before the next render.
      profileRef.current = { display_name: saved };
      setProfile(profileRef.current);
      if (invite) {
        const { id } = invite;
        setInvite(null);
        closeModal();
        await openMatch(id);
      }
    },
    [invite, openMatch, closeModal]
  );

  const createBoard = useCallback(
    async (hardMode) => {
      const id = await api.createBoard(hardMode);
      closeModal();
      await openMatch(id);
      dispatch({ type: "SHOW_MESSAGE", text: "Board created. Invite friends with the link button." });
    },
    [openMatch, closeModal, dispatch]
  );

  const createDuel = useCallback(
    async (hardMode) => {
      const id = await api.createDuel(hardMode);
      closeModal();
      await openMatch(id);
    },
    [openMatch, closeModal]
  );

  const startDuel = useCallback(async () => {
    try {
      await api.startDuel(state.boardId);
      await refresh(state.boardId);
    } catch (error) {
      showError(error);
    }
  }, [state.boardId, refresh, showError]);

  const cancelInvite = useCallback(() => {
    if (invite) setMatchInUrl(null);
    setInvite(null);
  }, [invite]);

  // Switching from an online game to another mode (e.g. Play Unlimited)
  // forgets it. Only an actual switch counts, so a game that is still
  // opening from a link keeps its URL.
  const previousMode = useRef(state.mode);
  useEffect(() => {
    if (ONLINE_MODES.includes(previousMode.current) && !ONLINE_MODES.includes(state.mode)) {
      setMatch(null);
      setMatchInUrl(null);
    }
    previousMode.current = state.mode;
  }, [state.mode]);

  // Send a guess the reducer marked as pending; the server scores it.
  useEffect(() => {
    if (!state.pending || !state.boardId) return;
    const id = state.boardId;
    const word = state.board[state.attempt].join("").toLowerCase();
    api.submitGuess(id, word).then(
      (reply) => {
        dispatch({ type: "GUESS_RESULT", result: reply.result, answer: reply.answer });
        if (state.mode === "duel") refresh(id);
      },
      (error) => {
        dispatch({ type: "GUESS_FAILED", message: error.message });
        if (state.mode === "duel") refresh(id);
      }
    );
  }, [state.pending, state.boardId, state.board, state.attempt, state.mode, dispatch, refresh]);

  // Keep data fresh: a live duel listens for pings (with polling as a
  // fallback); a finished friend board refreshes its scoreboard slowly.
  const matchId = state.boardId;
  const duelLive = state.mode === "duel" && match?.status !== "finished";
  const boardDone = state.mode === "board" && (state.status === "won" || state.status === "lost");
  useEffect(() => {
    if (!matchId || !(duelLive || boardDone)) return;
    const update = () => document.visibilityState !== "hidden" && refresh(matchId);
    if (boardDone) refresh(matchId);
    const unsubscribe = duelLive ? api.subscribe(matchId, () => refresh(matchId)) : null;
    const timer = setInterval(update, duelLive ? DUEL_POLL_MS : BOARD_REFRESH_MS);
    return () => {
      clearInterval(timer);
      unsubscribe?.();
    };
  }, [matchId, duelLive, boardDone, refresh]);

  // A running duel: start typing when the countdown ends, and check the
  // result as soon as the time limit passes.
  const duelId = match?.kind === "duel" && match.status === "active" ? match.id : null;
  const startsAt = match?.starts_at;
  const endsAt = match?.ends_at;
  useEffect(() => {
    if (!duelId) return;
    const timers = [];
    const until = (iso) => Date.parse(iso) - serverNow();
    if (until(startsAt) > 0) timers.push(setTimeout(() => dispatch({ type: "BEGIN" }), until(startsAt)));
    if (until(endsAt) > 0) timers.push(setTimeout(() => refresh(duelId), until(endsAt) + 500));
    return () => timers.forEach(clearTimeout);
  }, [duelId, startsAt, endsAt, serverNow, dispatch, refresh]);

  return {
    onlineEnabled,
    profile,
    loadProfile,
    match,
    invite,
    saveName,
    createBoard,
    createDuel,
    startDuel,
    cancelInvite,
    serverNow,
  };
}
