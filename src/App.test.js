import { render, screen, act, fireEvent } from "@testing-library/react";
import App from "./App";

// LF-only, like the committed Word-Bank.txt. With Math.random mocked to 0,
// the answer is always the first word.
const WORDS = "crane\nabout\nother\nwhich\nthere\ntheir\nwould\n";

beforeEach(() => {
  jest.spyOn(Math, "random").mockReturnValue(0);
  global.fetch = jest.fn(() => Promise.resolve({ text: () => Promise.resolve(WORDS) }));
});

afterEach(() => {
  jest.restoreAllMocks();
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

function rowLetters(rowIndex) {
  return Array.from(document.querySelectorAll(".row")[rowIndex].children);
}

test("accepts a valid word from an LF word list and colors the row", async () => {
  await renderLoaded();
  guess("about");
  expect(screen.queryByRole("status")).toBeEmptyDOMElement();
  expect(rowLetters(0).map((el) => el.id)).toEqual(["almost", "error", "error", "error", "error"]);
});

test("rejects a word that is not in the list without using up a row", async () => {
  await renderLoaded();
  guess("zzzzz");
  expect(screen.getByRole("status")).toHaveTextContent("Not in word list");
  expect(document.querySelectorAll(".row")[0]).toHaveClass("shake");
  expect(rowLetters(0).every((el) => !el.id)).toBe(true);
});

test("pressing Enter on an incomplete row explains why", async () => {
  await renderLoaded();
  guess("abo");
  expect(screen.getByRole("status")).toHaveTextContent("Not enough letters");
});

test("the toast disappears after a moment", async () => {
  jest.useFakeTimers();
  await renderLoaded();
  guess("zzzzz");
  expect(screen.getByRole("status")).toHaveTextContent("Not in word list");
  act(() => jest.advanceTimersByTime(1600));
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
  jest.useRealTimers();
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
  expect(document.querySelectorAll(".letter[id]")).toHaveLength(0);
  expect([...document.querySelectorAll(".letter")].every((el) => el.textContent === "")).toBe(true);

  // The new round accepts input on the first row again.
  guess("about");
  expect(rowLetters(0).map((el) => el.textContent).join("")).toBe("ABOUT");
});

test("six wrong guesses lose, and an invalid word on the last row does not", async () => {
  await renderLoaded();
  ["about", "other", "which", "there", "their"].forEach(guess);

  guess("zzzzz");
  expect(screen.queryByText("Could Not Guess The Word")).not.toBeInTheDocument();

  for (let i = 0; i < 5; i++) press("Backspace");
  guess("would");
  expect(screen.getByText("Could Not Guess The Word")).toBeInTheDocument();
});
