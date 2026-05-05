import { shuffle } from "./shuffle";

/**
 * Tokenize a sentence for the word-order exercise.
 * Basic rule: split by spaces.
 */
export function tokenizeSentence(text: string): string[] {
  return text
    .split(/\s+/)
    .map(t => t.trim())
    .filter(Boolean);
}

export function shuffleTokens(tokens: string[]): string[] {
  return shuffle(tokens);
}
