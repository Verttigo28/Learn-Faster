import { describe, expect, it } from "vitest";
import { dueCountByDeck, wordStatus } from "../src/services/deckProgress";
import { DAY } from "../src/services/srs";
import type { ReviewState } from "../src/db";

const NOW = new Date(2026, 9, 18, 12).getTime();
const rev = (deckId: string, dueInDays: number, interval = 3, direction: "forward" | "reverse" = "forward"): ReviewState => ({
  cardId: String(Math.random()), itemId: String(Math.random()), deckId, direction,
  ease: 2.5, interval, reps: 1, lapses: 0, due: NOW + dueInDays * DAY, introducedAt: 1, lastReviewed: 1
});

describe("dueCountByDeck", () => {
  it("counts forward cards due before tonight, per deck", () => {
    const map = dueCountByDeck([
      rev("a", -2), rev("a", 0.4), rev("a", 1), rev("a", -1, 3, "reverse"), rev("b", 0)
    ], NOW);
    expect(map.get("a")).toBe(2);
    expect(map.get("b")).toBe(1);
    expect(map.get("c")).toBeUndefined();
  });
});

describe("wordStatus", () => {
  it("classifies words", () => {
    expect(wordStatus(undefined, NOW)).toBe("new");
    expect(wordStatus(rev("a", 0), NOW)).toBe("due");
    expect(wordStatus(rev("a", 2, 3), NOW)).toBe("learning");
    expect(wordStatus(rev("a", 30, 30), NOW)).toBe("mastered");
  });
});
