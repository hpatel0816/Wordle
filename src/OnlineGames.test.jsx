import { render, screen, act, fireEvent, within } from "@testing-library/react";
import App from "./App";
import { api } from "./online/api";

// The server is mocked here; supabase/tests covers the real database rules.
vi.mock("./online/api", () => ({
  onlineEnabled: true,
  BOARD_PARAM: "board",
  boardUrl: (id) => `http://localhost:3000/?board=${id}`,
  api: {
    getProfile: vi.fn(),
    setDisplayName: vi.fn(),
    createBoard: vi.fn(),
    joinBoard: vi.fn(),
    submitGuess: vi.fn(),
    getBoard: vi.fn(),
    createDuel: vi.fn(),
    startDuel: vi.fn(),
    subscribe: vi.fn(() => () => {}),
  },
}));

const WORDS = "crane\nabout\ncream\nnacre\n";
const ALL_CORRECT = Array(5).fill("correct");

function boardData(overrides = {}) {
  return {
    id: "b1",
    hard_mode: false,
    closed: false,
    creator: "Sam",
    joined: true,
    answer: null,
    my_rows: [],
    players: [{ name: "Sam", is_me: false, finished: false, solved: false, guesses_used: 0, seconds: null, rows: null }],
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("seenHelp", "true");
  vi.spyOn(Math, "random").mockReturnValue(0);
  global.fetch = vi.fn(() => Promise.resolve({ text: () => Promise.resolve(WORDS) }));
  api.getProfile.mockResolvedValue({ display_name: "Jo" });
  api.joinBoard.mockResolvedValue(null);
  api.getBoard.mockResolvedValue(boardData());
  api.subscribe.mockImplementation(() => () => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  delete global.fetch;
  window.history.replaceState(null, "", "/");
});

async function settle() {
  await act(async () => {});
}

function press(key) {
  fireEvent.keyDown(document, { key });
}

async function guess(word) {
  [...word].forEach(press);
  press("Enter");
  await settle();
}

function rowStates(row) {
  return [...document.querySelectorAll(".row")[row].children].map((el) =>
    ["correct", "almost", "error"].find((c) => el.classList.contains(c)) ?? ""
  );
}

test("a board link asks a new player for a name, then joins and plays", async () => {
  window.history.replaceState(null, "", "/?board=b1");
  api.getProfile.mockResolvedValue(null);
  api.setDisplayName.mockResolvedValue("Jo");
  render(<App />);
  await settle();

  const dialog = screen.getByRole("dialog", { name: "Join a Friend Board" });
  expect(dialog).toHaveTextContent("Sam invited you");
  fireEvent.change(within(dialog).getByLabelText("Your name"), { target: { value: "Jo" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Join" }));
  await settle();

  expect(api.setDisplayName).toHaveBeenCalledWith("Jo");
  expect(api.joinBoard).toHaveBeenCalledWith("b1");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Friends" })).toHaveAttribute("aria-pressed", "true");

  api.submitGuess.mockResolvedValue({ result: ["almost", "error", "error", "error", "error"], finished: false, answer: null });
  await guess("about");
  expect(api.submitGuess).toHaveBeenCalledWith("b1", "about");
  expect(rowStates(0)).toEqual(["almost", "error", "error", "error", "error"]);
});

test("finishing a board shows the answer and the scoreboard, without touching stats", async () => {
  window.history.replaceState(null, "", "/?board=b1");
  render(<App />);
  await settle();

  api.getBoard.mockResolvedValue(
    boardData({
      answer: "crane",
      players: [
        { name: "Jo", is_me: true, finished: true, solved: true, guesses_used: 1, seconds: 42, rows: [{ word: "crane", result: ALL_CORRECT }] },
        { name: "Sam", is_me: false, finished: false, solved: false, guesses_used: 2, seconds: null, rows: [] },
      ],
    })
  );
  api.submitGuess.mockResolvedValue({ result: ALL_CORRECT, finished: true, solved: true, answer: "crane" });
  await guess("crane");

  expect(screen.getByText("Word: CRANE")).toBeInTheDocument();
  const scoreboard = screen.getByRole("region", { name: /Scoreboard/ });
  expect(within(scoreboard).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
    "1Jo (you)1/6 in 0:42",
    "2SamPlaying (2 so far)",
  ]);
  expect(localStorage.getItem("stats:unlimited")).toBeNull();
  expect(screen.getByRole("button", { name: "Invite friends" })).toBeInTheDocument();
});

test("a guess the server rejects unlocks the row and explains why", async () => {
  window.history.replaceState(null, "", "/?board=b1");
  render(<App />);
  await settle();
  api.submitGuess.mockRejectedValue(new Error("This board has closed"));
  await guess("about");
  expect(screen.getAllByRole("status")[0]).toHaveTextContent("This board has closed");
  expect(rowStates(0)).toEqual(["", "", "", "", ""]);
});

test("the Friends dialog creates a board and opens it", async () => {
  api.createBoard.mockResolvedValue("b2");
  api.getBoard.mockResolvedValue(boardData({ id: "b2", creator: "Jo" }));
  render(<App />);
  await settle();

  fireEvent.click(screen.getByRole("button", { name: "Friends" }));
  await settle();
  const dialog = screen.getByRole("dialog", { name: "Play with Friends" });
  expect(dialog).toHaveTextContent("Playing as Jo");
  fireEvent.click(within(dialog).getByRole("button", { name: "Create a friend board" }));
  await settle();

  expect(api.createBoard).toHaveBeenCalledWith(false);
  expect(window.location.search).toBe("?board=b2");
  expect(screen.getByRole("button", { name: "Friends" })).toHaveAttribute("aria-pressed", "true");
});

test("Play Unlimited leaves the board and clears the link", async () => {
  window.history.replaceState(null, "", "/?board=b1");
  render(<App />);
  await settle();
  api.submitGuess.mockResolvedValue({ result: ALL_CORRECT, finished: true, answer: "crane" });
  await guess("crane");
  fireEvent.click(screen.getByRole("button", { name: "Play Unlimited" }));
  await settle();
  expect(window.location.search).toBe("");
  expect(screen.getByRole("button", { name: "Unlimited" })).toHaveAttribute("aria-pressed", "true");
});

describe("live duels", () => {
  const now = () => new Date().toISOString();
  const later = (seconds) => new Date(Date.now() + seconds * 1000).toISOString();
  const player = (name, extra = {}) => ({
    name, is_me: false, is_host: false, is_winner: false, finished: false, solved: false,
    guesses_used: 0, seconds: null, rows: [], ...extra,
  });

  function duelData(overrides = {}) {
    return boardData({
      id: "d1",
      kind: "duel",
      status: "lobby",
      is_host: true,
      server_now: now(),
      starts_at: null,
      ends_at: later(3600),
      winner: null,
      players: [player("Jo", { is_me: true, is_host: true })],
      ...overrides,
    });
  }

  test("the host waits in the lobby, then starts once a friend joins", async () => {
    window.history.replaceState(null, "", "/?board=d1");
    api.getBoard.mockResolvedValue(duelData());
    let ping;
    api.subscribe.mockImplementation((id, onChange) => {
      ping = onChange;
      return () => {};
    });
    render(<App />);
    await settle();

    expect(screen.getByText("Waiting for a friend to join…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start duel" })).toBeDisabled();
    press("c");
    expect(document.querySelector(".row").children[0]).toHaveTextContent("");

    // The server pings when Riley joins.
    api.getBoard.mockResolvedValue(duelData({ players: [player("Jo", { is_me: true, is_host: true }), player("Riley")] }));
    await act(async () => ping());
    const start = screen.getByRole("button", { name: "Start duel" });
    expect(start).toBeEnabled();

    api.startDuel.mockResolvedValue(null);
    api.getBoard.mockResolvedValue(
      duelData({
        status: "active",
        starts_at: now(),
        ends_at: later(300),
        players: [player("Jo", { is_me: true, is_host: true }), player("Riley")],
      })
    );
    fireEvent.click(start);
    await settle();
    expect(api.startDuel).toHaveBeenCalledWith("d1");

    // The countdown is over, so typing works and the duel bar shows.
    press("c");
    expect(document.querySelector(".row").children[0]).toHaveTextContent("C");
    expect(screen.getByRole("timer", { name: "Time left" })).toHaveTextContent(/^[45]:\d\d$/);
    expect(within(screen.getByRole("list", { name: "Opponents" })).getByText("Riley")).toBeInTheDocument();
  });

  test("when someone else solves it first, the duel ends with them as the winner", async () => {
    window.history.replaceState(null, "", "/?board=d1");
    const active = {
      status: "active",
      is_host: false,
      starts_at: now(),
      ends_at: later(300),
      players: [player("Riley", { is_host: true }), player("Jo", { is_me: true })],
    };
    api.getBoard.mockResolvedValue(duelData(active));
    let ping;
    api.subscribe.mockImplementation((id, onChange) => {
      ping = onChange;
      return () => {};
    });
    render(<App />);
    await settle();

    api.submitGuess.mockResolvedValue({ result: ["almost", "error", "error", "error", "error"], finished: false, match_over: false, answer: null });
    await guess("about");

    api.getBoard.mockResolvedValue(
      duelData({
        ...active,
        status: "finished",
        winner: "Riley",
        answer: "crane",
        players: [
          player("Riley", { is_host: true, is_winner: true, finished: true, solved: true, guesses_used: 2, seconds: 40, rows: [] }),
          player("Jo", { is_me: true, guesses_used: 1, rows: [] }),
        ],
      })
    );
    await act(async () => ping());

    expect(screen.getByText("Riley won the duel")).toBeInTheDocument();
    expect(screen.getByText("Word: CRANE")).toBeInTheDocument();
    expect(screen.getByText("🏆 2/6 in 0:40")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New duel" })).toBeInTheDocument();
    // Typing does nothing once the duel is over.
    press("c");
    expect(document.querySelectorAll(".row")[1].children[0]).toHaveTextContent("");
  });
});
