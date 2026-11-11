import wordBank from "./Word-Bank.txt";
import { parseWordList } from "./gameLogic";
export const displayDefault = [
    ["", "", "", "", ""], 
    ["", "", "", "", ""], 
    ["", "", "", "", ""], 
    ["", "", "", "", ""], 
    ["", "", "", "", ""], 
    ["", "", "", "", ""]
];

export const generateWordSet = async () => {
  let wordSet;
  let todaysWord;
  await fetch(wordBank)
    .then((response) => response.text())
    .then((result) => {
      const wordArray = parseWordList(result);
      todaysWord = wordArray[Math.floor(Math.random()*wordArray.length)];
      wordSet = new Set(wordArray);
    });

  return { wordSet, todaysWord};
};