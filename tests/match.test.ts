import { describe, expect, it } from "vitest";
import { buildMatchRounds, packMatchRounds, toMatchPair, type MatchSource } from "../src/services/match";
import { normalizeAnswer } from "../src/utils/answer";

const make = (n: number): MatchSource[] =>
  Array.from({ length: n }, (_, i) => ({ id: `d:${i}`, deckId: "d", term: `term${i}`, definition: `def${i}` }));

function assertUnambiguous(rounds: { left: string; right: string }[][]) {
  for (const r of rounds) {
    const lefts = r.map((p) => normalizeAnswer(p.left));
    const rights = r.map((p) => normalizeAnswer(p.right));
    expect(new Set(lefts).size).toBe(r.length);
    expect(new Set(rights).size).toBe(r.length);
  }
}

describe("buildMatchRounds", () => {
  it("makes 3 rounds of 6 pairs by default", () => {
    const rounds = buildMatchRounds(make(40));
    expect(rounds.map((r) => r.length)).toEqual([6, 6, 6]);
    expect(new Set(rounds.flat().map((p) => p.id)).size).toBe(18);
  });

  it("respects roundSize / rounds and balances small games", () => {
    expect(buildMatchRounds(make(40), { roundSize: 4, rounds: 2 }).map((r) => r.length)).toEqual([4, 4]);
    expect(buildMatchRounds(make(7)).map((r) => r.length)).toEqual([4, 3]);
    expect(buildMatchRounds(make(3)).map((r) => r.length)).toEqual([3]);
  });

  it("returns nothing when there are fewer than 2 usable words", () => {
    expect(buildMatchRounds([])).toEqual([]);
    expect(buildMatchRounds(make(1))).toEqual([]);
    expect(buildMatchRounds([{ id: "x", term: "a", definition: " " }, { id: "y", term: "", definition: "b" }])).toEqual([]);
  });

  it("never puts two identical definitions or terms in the same round", () => {
    const items: MatchSource[] = [
      { id: "1", term: "besar", definition: "grand" },
      { id: "2", term: "raya", definition: "Grand !" },
      { id: "3", term: "tinggi", definition: "grand" },
      { id: "4", term: "bisa", definition: "pouvoir" },
      { id: "5", term: "Bisa", definition: "venin" },
      { id: "6", term: "makan", definition: "manger" },
      { id: "7", term: "minum", definition: "boire" },
      { id: "8", term: "tidur", definition: "dormir" }
    ];
    for (let i = 0; i < 50; i++) {
      const rounds = buildMatchRounds(items, { roundSize: 6 });
      assertUnambiguous(rounds);
    }
  });

  it("keeps duplicate pairs only once", () => {
    const items: MatchSource[] = [
      { id: "1", term: "rumah", definition: "maison" },
      { id: "2", term: "Rumah", definition: "maison" },
      { id: "3", term: "air", definition: "eau" }
    ];
    expect(buildMatchRounds(items).flat()).toHaveLength(2);
  });

  it("swaps the columns in reverse direction and keeps the term for speech", () => {
    const rounds = buildMatchRounds(make(4), { reverse: true });
    for (const p of rounds.flat()) {
      expect(p.left).toMatch(/^def/);
      expect(p.right).toMatch(/^term/);
      expect(p.term).toBe(p.right);
    }
    expect(toMatchPair({ id: "a", term: "x", definition: "y" })).toEqual({ id: "a", deckId: undefined, left: "x", right: "y", term: "x" });
  });
});

describe("packMatchRounds", () => {
  it("keeps the input order and allows single-pair rounds when asked", () => {
    const pairs = make(8).map((it) => toMatchPair(it)!);
    const rounds = packMatchRounds(pairs, { roundSize: 6, rounds: 10, minRoundSize: 1 });
    expect(rounds.map((r) => r.length)).toEqual([4, 4]);
    expect(packMatchRounds(pairs.slice(0, 1), { minRoundSize: 1 })).toHaveLength(1);
    expect(packMatchRounds(pairs.slice(0, 1))).toHaveLength(0);
  });
});
