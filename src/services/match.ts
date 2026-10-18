import { normalizeAnswer } from "../utils/answer";
import { shuffle } from "../utils/shuffle";

/**
 * "Match" game: rounds of pairs to associate (left column ↔ right column).
 * Pure logic, no Vue / Dexie, so it is unit-tested in tests/match.test.ts.
 */

export type MatchSource = { id: string; deckId?: string; term: string; definition: string };

export type MatchPair = {
  id: string;
  deckId?: string;
  /** Shown in the left column (the term, or the definition in reverse mode). */
  left: string;
  /** Shown in the right column. */
  right: string;
  /** Original term (target language), for text-to-speech. */
  term: string;
};

export type MatchOptions = {
  /** Pairs per round (default 6). */
  roundSize?: number;
  /** Maximum number of rounds (default 3). */
  rounds?: number;
  /** Left column = definitions, right column = terms. */
  reverse?: boolean;
  /** Rounds smaller than this are dropped (default 2: a single pair is not a puzzle). */
  minRoundSize?: number;
};

const keyOf = (s: string) => normalizeAnswer(s) || s.trim().toLowerCase();

/** Item -> pair in the requested direction (null when a side is empty). */
export function toMatchPair(item: MatchSource, reverse = false): MatchPair | null {
  const term = item.term?.trim() ?? "";
  const definition = item.definition?.trim() ?? "";
  if (!term || !definition) return null;
  return {
    id: item.id,
    deckId: item.deckId,
    left: reverse ? definition : term,
    right: reverse ? term : definition,
    term
  };
}

/**
 * Packs pairs into rounds without ambiguity: inside one round, no two pairs share the same
 * normalized left text nor the same normalized right text (otherwise two answers would be valid).
 * Duplicate pairs (same left and right) are kept once. Rounds are balanced (7 pairs -> 4 + 3, not 6 + 1).
 * The input order is kept: shuffle beforehand for a random game.
 */
export function packMatchRounds(pairs: MatchPair[], opts: Omit<MatchOptions, "reverse"> = {}): MatchPair[][] {
  const roundSize = Math.max(1, Math.floor(opts.roundSize ?? 6));
  const maxRounds = Math.max(1, Math.floor(opts.rounds ?? 3));
  const minRoundSize = Math.max(1, Math.floor(opts.minRoundSize ?? 2));

  const seen = new Set<string>();
  const pool: MatchPair[] = [];
  for (const p of pairs) {
    const k = `${keyOf(p.left)}\u0000${keyOf(p.right)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    pool.push(p);
  }

  const total = Math.min(pool.length, roundSize * maxRounds);
  if (total === 0) return [];
  const count = Math.ceil(total / roundSize);
  const base = Math.floor(total / count);
  const sizes = Array.from({ length: count }, (_, i) => base + (i < total % count ? 1 : 0));

  const rounds: MatchPair[][] = sizes.map(() => []);
  const lefts = sizes.map(() => new Set<string>());
  const rights = sizes.map(() => new Set<string>());
  let placed = 0;

  for (const p of pool) {
    if (placed >= total) break;
    const l = keyOf(p.left);
    const r = keyOf(p.right);
    const i = rounds.findIndex((round, j) => round.length < sizes[j] && !lefts[j].has(l) && !rights[j].has(r));
    if (i < 0) continue;
    rounds[i].push(p);
    lefts[i].add(l);
    rights[i].add(r);
    placed++;
  }

  return rounds.filter((r) => r.length >= minRoundSize);
}

/** Random rounds from vocabulary items (see packMatchRounds for the rules). */
export function buildMatchRounds(items: MatchSource[], opts: MatchOptions = {}): MatchPair[][] {
  const pairs = items.map((it) => toMatchPair(it, opts.reverse)).filter((p): p is MatchPair => p !== null);
  return packMatchRounds(shuffle(pairs), opts);
}
