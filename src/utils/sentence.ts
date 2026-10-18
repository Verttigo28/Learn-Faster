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

/** Shuffle tokens, avoiding (when possible) handing back the already-solved order. */
export function shuffleTokens(tokens: string[]): string[] {
  const solved = tokens.join("\u0000");
  const out = shuffle(tokens);
  if (out.join("\u0000") !== solved || new Set(tokens).size < 2) return out;
  // Still solved: rotate by one (always differs since at least two tokens differ).
  return [...out.slice(1), out[0]];
}
