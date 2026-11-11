import { render, screen, act, fireEvent } from "@testing-library/react";
import App from "./App";

// LF-only, like the committed Word-Bank.txt. With Math.random mocked to 0,
// the answer is always the first word. The NACRE-style entries reuse only
// CRANE's letters, so none get ruled out across six wrong guesses.
const WORDS = "crane\nabout\ncream\nnacre\ncaner\nrance\nancre\nacern\nrecan\n";

beforeEach(() => {
  localStorage.clear();
  // Skip the first-visit help dialog unless a test opts in.
  localStorage.setItem("seenHelp", "true");
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.palette;
  vi.spyOn(Math, "random").mockReturnValue(0);
  global.fetch = vi.fn(() => Promise.resolve({ text: () => Promise.resolve(WORDS) }));
});

afterEach(() => {
  vi.restoreAllMocks();
  delete global.fetch;
});

async function renderLoaded() {
  render(<App />);
  // Let the word list fetch resolve.
  await act(async () => {});
}

// One act-wrapped keydown per key, so React re-renders (and the keyboard
// listener picks up fresh state) between keystrokes.
function press(key) {
  fireEvent.keyDown(document, { key });
}

function guess(word) {
  [...word].forEach(press);
  press("Enter");
}

// "correct" | "almost" | "error", or "" before the row is submitted.
function tileState(el) {
  return ["correct", "almost", "error"].find((c) => el.classList.contains(c)) ?? "";
}

// The typed letter only, without the screen-reader status text.
function tileLetter(el) {
  return el.firstChild?.textContent ?? "";
}

function rowLetters(rowIndex) {
  return Array.from(document.querySelectorAll(".row")[rowIndex].children);
}

test("accepts a valid word from an LF word list and colors the row", async () => {
  await renderLoaded();
  guess("about");
  expect(screen.queryByRole("status")).toBeEmptyDOMElement();
  expect(rowLetters(0).map(tileState)).toEqual(["almost", "error", "error", "error", "error"]);
});

test("keyboard keys show the best status for each guessed letter", async () => {
  await renderLoaded();
  guess("about");
  guess("cream");
  const key = (letter) => screen.getByText(letter, { selector: ".key" });
  expect(key("T")).toHaveAccessibleName("T, not in the word");
  expect(key("C")).toHaveClass("correct");
  expect(key("R")).toHaveClass("correct");
  expect(key("A")).toHaveClass("almost");
  expect(key("E")).toHaveClass("almost");
  expect(key("T")).toHaveClass("error");
  expect(key("T")).toHaveAttribute("aria-disabled", "true");
  expect(key("Q").className).toBe("key");
});

test("typing a ruled-out letter is blocked with an explanation", async () => {
  await renderLoaded();
  guess("about");
  press("t");
  expect(rowLetters(1)[0]).toHaveTextContent("");
  expect(screen.getByRole("status")).toHaveTextContent("T is not in the word");
});

test("rejects a word that is not in the list without using up a row", async () => {
  await renderLoaded();
  guess("zzzzz");
  expect(screen.getByRole("status")).toHaveTextContent("Not in word list");
  expect(document.querySelectorAll(".row")[0]).toHaveClass("shake");
  expect(rowLetters(0).every((el) => tileState(el) === "")).toBe(true);
});

test("pressing Enter on an incomplete row explains why", async () => {
  await renderLoaded();
  guess("abo");
  expect(screen.getByRole("status")).toHaveTextContent("Not enough letters");
});

test("the toast disappears after a moment", async () => {
  vi.useFakeTimers();
  await renderLoaded();
  guess("zzzzz");
  expect(screen.getByRole("status")).toHaveTextContent("Not in word list");
  act(() => vi.advanceTimersByTime(1600));
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
  vi.useRealTimers();
});

test("guessing the answer wins the game", async () => {
  await renderLoaded();
  guess("about");
  guess("crane");
  expect(screen.getByText("You Correctly Guessed")).toBeInTheDocument();
  expect(screen.getByText(/You Guessed In 2 Tries/)).toBeInTheDocument();
});

test("Play Again starts a fresh round", async () => {
  await renderLoaded();
  guess("crane");
  fireEvent.click(screen.getByRole("button", { name: "Play Again" }));

  expect(screen.queryByText("You Correctly Guessed")).not.toBeInTheDocument();
  expect([...document.querySelectorAll(".letter")].every((el) => tileState(el) === "")).toBe(true);
  expect([...document.querySelectorAll(".letter")].every((el) => tileLetter(el) === "")).toBe(true);

  // The new round accepts input on the first row again.
  guess("about");
  expect(rowLetters(0).map(tileLetter).join("")).toBe("ABOUT");
});

test("six wrong guesses lose, and an invalid word on the last row does not", async () => {
  await renderLoaded();
  ["nacre", "caner", "rance", "ancre", "acern"].forEach(guess);

  guess("zzzzz");
  expect(screen.queryByText("Could Not Guess The Word")).not.toBeInTheDocument();

  for (let i = 0; i < 5; i++) press("Backspace");
  guess("recan");
  expect(screen.getByText("Could Not Guess The Word")).toBeInTheDocument();
});

test("tiles and the announcer describe each scored guess for screen readers", async () => {
  await renderLoaded();
  guess("cream");
  expect(rowLetters(0)[0]).toHaveTextContent("C, correct");
  expect(rowLetters(0)[2]).toHaveTextContent("E, in the word, wrong spot");
  expect(screen.getByTestId("guess-announcer")).toHaveTextContent(
    "Guess 1: C correct, R correct, E in the word, wrong spot, A in the word, wrong spot, M not in the word"
  );
});

test("on-screen keys are buttons and the Delete key has a text label", async () => {
  await renderLoaded();
  fireEvent.click(screen.getByRole("button", { name: "C" }));
  expect(tileLetter(rowLetters(0)[0])).toBe("C");
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  expect(tileLetter(rowLetters(0)[0])).toBe("");
});

test("Enter on a focused button is left to the button", async () => {
  await renderLoaded();
  for (const c of "crane") press(c);
  const cKey = screen.getByRole("button", { name: "C" });
  fireEvent.keyDown(cKey, { key: "Enter" });
  expect(screen.queryByText("You Correctly Guessed")).not.toBeInTheDocument();
});

test("settings switch to color-blind colors and remember the choice", async () => {
  await renderLoaded();
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  const toggle = screen.getByRole("switch", { name: "Color-blind colors" });
  expect(toggle).toHaveAttribute("aria-checked", "false");
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-checked", "true");
  expect(document.documentElement).toHaveAttribute("data-palette", "high-contrast");
  expect(localStorage.getItem("highContrast")).toBe("true");
});

test("settings switch to a light theme that persists across visits", async () => {
  const { unmount } = render(<App />);
  await act(async () => {});
  expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  fireEvent.click(screen.getByRole("switch", { name: "Light theme" }));
  expect(document.documentElement).toHaveAttribute("data-theme", "light");
  unmount();

  await renderLoaded();
  expect(document.documentElement).toHaveAttribute("data-theme", "light");
});

test("typing is ignored while settings are open", async () => {
  await renderLoaded();
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  press("c");
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(tileLetter(rowLetters(0)[0])).toBe("");
});

test("the help dialog opens on a first visit and is remembered once closed", async () => {
  localStorage.removeItem("seenHelp");
  await renderLoaded();
  const dialog = screen.getByRole("dialog", { name: "How To Play" });
  expect(dialog).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();

  // Game input is ignored while it is open.
  press("c");
  expect(tileLetter(rowLetters(0)[0])).toBe("");

  fireEvent.keyDown(dialog, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(localStorage.getItem("seenHelp")).toBe("true");

  press("c");
  expect(tileLetter(rowLetters(0)[0])).toBe("C");
});

test("the ? button reopens the help dialog", async () => {
  await renderLoaded();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "How to play" }));
  expect(screen.getByRole("dialog", { name: "How To Play" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
