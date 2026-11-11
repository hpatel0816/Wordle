import wordBank from "./Word-Bank.txt";
import { parseWordList } from "./gameLogic";

// Fetch the bundled word list at runtime so it stays out of the JS bundle.
export async function loadWordList() {
  const response = await fetch(wordBank);
  return parseWordList(await response.text());
}
