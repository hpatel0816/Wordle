import { useCallback, useEffect, useRef, useState } from "react";
import { BOARD_PARAM, api, onlineEnabled } from "./api";

const REFRESH_MS = 15000;

function setBoardInUrl(id) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set(BOARD_PARAM, id);
  else url.searchParams.delete(BOARD_PARAM);
  window.history.replaceState(null, "", url);
}

// Everything about friend boards that lives outside the reducer: the
// player's display name, joining and creating boards, sending pending
// guesses to the server, and keeping the scoreboard fresh.
export function useFriendBoard({ state, dispatch, openModal, closeModal }) {
  // undefined = not loaded yet, null = no display name chosen.
  const [profile, setProfile] = useState(undefined);
  const profileRef = useRef(profile);
  profileRef.current = profile;

  const [board, setBoard] = useState(null); // latest get_match() result
  const [invite, setInvite] = useState(null); // { id, creator } waiting for a name

  const showError = useCallback(
    (error) => dispatch({ type: "SHOW_MESSAGE", text: error.message }),
    [dispatch]
  );

  const loadProfile = useCallback(async () => {
    if (profileRef.current !== undefined) return profileRef.current;
    const loaded = (await api.getProfile()) ?? null;
    profileRef.current = loaded;
    setProfile(loaded);
    return loaded;
  }, []);

  // Join a board (asking for a name first if needed) and start playing it.
  const openBoard = useCallback(
    async (id) => {
      try {
        const preview = await api.getBoard(id);
        if (!(await loadProfile())) {
          setInvite({ id, creator: preview.creator });
          openModal("friends");
          return;
        }
        await api.joinBoard(id);
        const data = await api.getBoard(id);
        setBoard(data);
        setBoardInUrl(id);
        dispatch({
          type: "START",
          mode: "board",
          boardId: id,
          answer: data.answer ?? "",
          rows: data.my_rows,
          hardMode: data.hard_mode,
        });
      } catch (error) {
        setBoardInUrl(null);
        showError(error);
      }
    },
    [dispatch, loadProfile, openModal, showError]
  );

  // Open a board from a ?board= link once the word list has loaded.
  const linkHandled = useRef(false);
  useEffect(() => {
    if (state.status === "loading" || linkHandled.current) return;
    linkHandled.current = true;
    const id = new URLSearchParams(window.location.search).get(BOARD_PARAM);
    if (!id) return;
    if (!onlineEnabled) {
      setBoardInUrl(null);
      dispatch({ type: "SHOW_MESSAGE", text: "Online play isn't set up on this site" });
      return;
    }
    openBoard(id);
  }, [state.status, openBoard, dispatch]);

  const saveName = useCallback(
    async (name) => {
      const saved = await api.setDisplayName(name);
      // Update the ref now: openBoard below runs before the next render.
      profileRef.current = { display_name: saved };
      setProfile(profileRef.current);
      if (invite) {
        const { id } = invite;
        setInvite(null);
        closeModal();
        await openBoard(id);
      }
    },
    [invite, openBoard, closeModal]
  );

  const createBoard = useCallback(
    async (hardMode) => {
      const id = await api.createBoard(hardMode);
      closeModal();
      await openBoard(id);
      dispatch({ type: "SHOW_MESSAGE", text: "Board created. Invite friends with the link button." });
    },
    [openBoard, closeModal, dispatch]
  );

  const cancelInvite = useCallback(() => {
    if (invite) setBoardInUrl(null);
    setInvite(null);
  }, [invite]);

  // Switching from a board to another mode (e.g. Play Unlimited) forgets
  // the board. Only an actual switch counts, so a board that is still
  // opening from a link keeps its URL.
  const previousMode = useRef(state.mode);
  useEffect(() => {
    if (previousMode.current === "board" && state.mode !== "board") {
      setBoard(null);
      setBoardInUrl(null);
    }
    previousMode.current = state.mode;
  }, [state.mode]);

  // Send a guess the reducer marked as pending; the server scores it.
  useEffect(() => {
    if (!state.pending || !state.boardId) return;
    const word = state.board[state.attempt].join("").toLowerCase();
    api.submitGuess(state.boardId, word).then(
      (reply) => dispatch({ type: "GUESS_RESULT", result: reply.result, answer: reply.answer }),
      (error) => dispatch({ type: "GUESS_FAILED", message: error.message })
    );
  }, [state.pending, state.boardId, state.board, state.attempt, dispatch]);

  // Refresh the scoreboard when the player finishes, then every few seconds
  // while it's on screen.
  const finished = state.mode === "board" && (state.status === "won" || state.status === "lost");
  const boardId = state.boardId;
  useEffect(() => {
    if (!finished || !boardId) return;
    let stopped = false;
    const refresh = () =>
      api.getBoard(boardId).then(
        (data) => !stopped && setBoard(data),
        () => {} // keep showing the last scoreboard
      );
    refresh();
    const timer = setInterval(() => document.visibilityState === "visible" && refresh(), REFRESH_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [finished, boardId]);

  return { onlineEnabled, profile, loadProfile, board, invite, saveName, createBoard, cancelInvite };
}
