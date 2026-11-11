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
