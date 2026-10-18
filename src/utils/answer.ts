/** Lowercase, strip accents / punctuation, collapse spaces: "  L'Été ! " -> "l ete" */
export function normalizeAnswer(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** A definition may list alternatives: "manger / bouffer", "grand; gros", "(se) laver". */
export function acceptedAnswers(expected: string): string[] {
  const parts = expected.split(/[/;,|]/).map((p) => p.trim()).filter(Boolean);
  const out = new Set<string>();
  for (const p of parts.length ? parts : [expected]) {
    out.add(normalizeAnswer(p));
    // optional parts in parentheses: "(se) laver" accepts "laver" and "se laver"
    if (/\(.*\)/.test(p)) out.add(normalizeAnswer(p.replace(/\([^)]*\)/g, " ")));
  }
  out.delete("");
  return [...out];
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

export type AnswerCheck = { correct: boolean; typo: boolean };

/**
 * Exact match after normalization, or one typo allowed for answers of 5+ letters.
 */
export function checkAnswer(answer: string, expected: string): AnswerCheck {
  const a = normalizeAnswer(answer);
  if (!a) return { correct: false, typo: false };
  const accepted = acceptedAnswers(expected);
  if (accepted.includes(a)) return { correct: true, typo: false };
  const close = accepted.some((x) => x.length >= 5 && levenshtein(a, x) <= 1);
  return { correct: close, typo: close };
}
