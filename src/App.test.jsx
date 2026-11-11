import { render, screen, act, fireEvent, within } from "@testing-library/react";
import App from "./App";
import { encodeChallenge, getAnswerPool, getDailyAnswer, getDayNumber, parseWordList } from "./gameLogic";

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
  window.history.replaceState(null, "", "/");
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

test("hard mode is set in Settings and locks once a round is under way", async () => {
  await renderLoaded();
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  fireEvent.click(screen.getByRole("switch", { name: "Hard mode" }));
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(localStorage.getItem("hardMode")).toBe("true");

  guess("nacre");
  guess("about");
  expect(screen.getByRole("status")).toHaveTextContent("5th letter must be E");

  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  const toggle = screen.getByRole("switch", { name: "Hard mode" });
  expect(toggle).toHaveAttribute("aria-disabled", "true");
  expect(toggle).toHaveAccessibleDescription("Can only be changed at the start of a round");
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-checked", "true");
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

describe("daily mode", () => {
  const dailyAnswer = () => getDailyAnswer(getAnswerPool(parseWordList(WORDS)), getDayNumber());

  test("plays today's puzzle and keeps the result after a reload", async () => {
    const { unmount } = render(<App />);
    await act(async () => {});
    fireEvent.click(screen.getByRole("button", { name: /^Daily #\d+$/ }));
    expect(screen.getByRole("button", { name: /^Daily/ })).toHaveAttribute("aria-pressed", "true");

    guess(dailyAnswer());
    expect(screen.getByText("You Correctly Guessed")).toBeInTheDocument();
    expect(screen.getByRole("timer")).toHaveTextContent(/^\d\d:\d\d:\d\d$/);
    expect(screen.getByRole("button", { name: "Play Unlimited" })).toBeInTheDocument();
    unmount();

    // A reload comes back to the finished daily, which can't be replayed.
    await renderLoaded();
    expect(screen.getByRole("button", { name: /^Daily/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("You Correctly Guessed")).toBeInTheDocument();
    expect(rowLetters(0).map(tileLetter).join("")).toBe(dailyAnswer().toUpperCase());

    fireEvent.click(screen.getByRole("button", { name: "Play Unlimited" }));
    expect(screen.getByRole("button", { name: "Unlimited" })).toHaveAttribute("aria-pressed", "true");
    expect(rowLetters(0).map(tileLetter).join("")).toBe("");
  });

  test("switching modes keeps each mode's round in progress", async () => {
    await renderLoaded();
    guess("about");
    fireEvent.click(screen.getByRole("button", { name: /^Daily/ }));
    expect(rowLetters(0).map(tileLetter).join("")).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Unlimited" }));
    expect(rowLetters(0).map(tileLetter).join("")).toBe("ABOUT");
  });
});

test("an unfinished round resumes after a reload", async () => {
  const { unmount } = render(<App />);
  await act(async () => {});
  guess("about");
  unmount();

  await renderLoaded();
  expect(rowLetters(0).map(tileLetter).join("")).toBe("ABOUT");
  expect(rowLetters(0).map(tileState)).toEqual(["almost", "error", "error", "error", "error"]);
  guess("crane");
  expect(screen.getByText(/You Guessed In 2 Tries/)).toBeInTheDocument();
});

describe("statistics", () => {
  const statValue = (label) =>
    screen.getByText(label, { selector: "dt" }).parentElement.querySelector("dd").textContent;

  test("a finished round is counted once and shown in the Statistics dialog", async () => {
    const { unmount } = render(<App />);
    await act(async () => {});
    guess("about");
    guess("crane");
    fireEvent.click(screen.getAllByRole("button", { name: "Statistics" })[0]);
    const dialog = screen.getByRole("dialog", { name: "Statistics" });
    expect(within(dialog).getByRole("button", { name: "Unlimited" })).toHaveAttribute("aria-pressed", "true");
    expect(statValue("Played")).toBe("1");
    expect(statValue("Win %")).toBe("100");
    expect(statValue("Current Streak")).toBe("1");
    expect(screen.getByText("2 guesses: 1 win")).toBeInTheDocument();
    unmount();

    // Reloading shows the finished round again without counting it twice.
    await renderLoaded();
    fireEvent.click(screen.getAllByRole("button", { name: "Statistics" })[0]);
    expect(statValue("Played")).toBe("1");
  });

  test("a loss resets the streak", async () => {
    await renderLoaded();
    guess("crane");
    fireEvent.click(screen.getByRole("button", { name: "Play Again" }));
    ["nacre", "caner", "rance", "ancre", "acern", "recan"].forEach(guess);
    fireEvent.click(screen.getAllByRole("button", { name: "Statistics" })[0]);
    expect(statValue("Played")).toBe("2");
    expect(statValue("Win %")).toBe("50");
    expect(statValue("Current Streak")).toBe("0");
    expect(statValue("Max Streak")).toBe("1");
  });
});

test("Share copies the emoji grid to the clipboard", async () => {
  const writeText = vi.fn(() => Promise.resolve());
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  await renderLoaded();
  guess("about");
  guess("crane");
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
  });
  expect(writeText).toHaveBeenCalledWith("WeWordle Unlimited 2/6\n\n🟨⬛⬛⬛⬛\n🟩🟩🟩🟩🟩");
  expect(screen.getAllByRole("status")[0]).toHaveTextContent("Copied to clipboard");
  delete navigator.clipboard;
});

describe("challenge links", () => {
  test("a challenge link starts a round with the friend's word that isn't counted in stats", async () => {
    window.history.replaceState(null, "", `/?challenge=${encodeChallenge("nacre")}`);
    await renderLoaded();
    expect(screen.getByRole("button", { name: "Friend's challenge" })).toHaveAttribute("aria-pressed", "true");
    guess("nacre");
    expect(screen.getByText("You Correctly Guessed")).toBeInTheDocument();
    expect(localStorage.getItem("stats:unlimited")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Play Unlimited" }));
    expect(window.location.search).toBe("");
    expect(screen.getByRole("button", { name: "Unlimited" })).toHaveAttribute("aria-pressed", "true");
  });

  test("an invalid challenge link falls back to a normal round with a message", async () => {
    window.history.replaceState(null, "", "/?challenge=zzzzz");
    await renderLoaded();
    expect(screen.getByRole("button", { name: "Unlimited" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByRole("status")[0]).toHaveTextContent("That challenge link isn't valid");
    expect(window.location.search).toBe("");
  });

  test("Challenge a friend copies a link for the word just played or a chosen word", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await renderLoaded();
    guess("crane");
    fireEvent.click(screen.getByRole("button", { name: "Challenge a friend" }));
    const dialog = screen.getByRole("dialog", { name: "Challenge a Friend" });
    const input = within(dialog).getByLabelText("Word");
    expect(input).toHaveValue("CRANE");

    fireEvent.change(input, { target: { value: "zz1zzz" } });
    expect(input).toHaveValue("ZZZZZ");
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Copy link" }));
    });
    expect(within(dialog).getByRole("status")).toHaveTextContent("Not in word list");
    expect(writeText).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "about" } });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Copy link" }));
    });
    expect(writeText).toHaveBeenCalledWith(
      `Can you guess my WeWordle word? http://localhost:3000/?challenge=${encodeChallenge("about")}`
    );
    expect(within(dialog).getByRole("status")).toHaveTextContent("Link copied");
    delete navigator.clipboard;
  });
});
