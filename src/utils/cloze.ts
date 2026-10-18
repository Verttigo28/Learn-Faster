import { shuffle } from "./shuffle";

export const BLANK = "_____";

/** Splits "nasi." into ["", "nasi", "."] so punctuation stays visible around the blank. */
function splitWord(token: string): [string, string, string] {
  const m = token.match(/^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/u);
  return m ? [m[1], m[2], m[3]] : ["", token, ""];
}

/**
 * Hides one word of the sentence, preferring long words (more meaningful than "di", "ke"...).
 * Returns null when no word is usable.
 */
export function makeCloze(tokens: string[]): { display: string; answer: string } | null {
  const candidates = tokens
    .map((t, i) => ({ i, word: splitWord(t)[1] }))
    .filter((c) => c.word.length >= 2);
  if (!candidates.length || tokens.length < 2) return null;

  const maxLen = Math.max(...candidates.map((c) => c.word.length));
  const pool = candidates.filter((c) => c.word.length >= Math.min(4, maxLen));
  const pick = shuffle(pool)[0];
  const [pre, word, post] = splitWord(tokens[pick.i]);

  const display = tokens.map((t, i) => (i === pick.i ? `${pre}${BLANK}${post}` : t)).join(" ");
  return { display, answer: word };
}
