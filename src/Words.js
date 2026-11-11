import wordBank from "./Word-Bank.txt";
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
      // Handle both LF and CRLF line endings; normalize to lowercase.
      const wordArray = result
        .split(/\r?\n/)
        .map((word) => word.trim().toLowerCase())
        .filter(Boolean);
      todaysWord = wordArray[Math.floor(Math.random()*wordArray.length)];
      wordSet = new Set(wordArray);
    });

  return { wordSet, todaysWord};
};