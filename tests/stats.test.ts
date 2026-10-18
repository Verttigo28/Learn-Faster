import { describe, expect, it } from "vitest";
import { activityByDay, answersToday, bestStreak, deckProgress, hardestWords, heatLevel, heatmapWeeks, streak } from "../src/services/stats";
import { DAY } from "../src/services/srs";
import type { Attempt, ReviewState, VocabItem } from "../src/db";

const NOW = new Date(2026, 9, 18, 12).getTime();
const att = (daysAgo: number, total = 10, correct = 5): Attempt => ({
  id: String(Math.random()), type: "flashcards", refId: "d", startedAt: 0,
  finishedAt: NOW - daysAgo * DAY, score: correct / total, meta: { total, correct }
});

describe("streak", () => {
  it("counts consecutive days ending today", () => {
    expect(streak([att(0), att(1), att(2), att(4)], NOW)).toBe(3);
  });
  it("is kept until the end of the day", () => {
    expect(streak([att(1), att(2)], NOW)).toBe(2);
  });
  it("is zero without recent activity", () => {
    expect(streak([att(3)], NOW)).toBe(0);
  });
});

describe("activity", () => {
  it("fills empty days and sums answers", () => {
    const a = activityByDay([att(0, 4, 3), att(0, 6, 1), att(2)], 3, NOW);
    expect(a.map((d) => d.answers)).toEqual([10, 0, 10]);
    expect(a[2].correct).toBe(4);
    expect(answersToday([att(0, 4), att(1, 9)], NOW)).toBe(4);
  });
});

describe("best streak and heatmap", () => {
  it("finds the longest run of consecutive days", () => {
    expect(bestStreak([])).toBe(0);
    expect(bestStreak([att(0), att(1), att(5), att(6), att(7), att(8), att(8), att(20)])).toBe(4);
  });
  it("builds Monday-first weeks ending with the current week", () => {
    // NOW = Sunday 18 Oct 2026
    const weeks = heatmapWeeks([att(0, 3), att(6, 2), att(13, 7)], 3, NOW);
    expect(weeks).toHaveLength(3);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(new Date(weeks[0][0].date).getDay()).toBe(1);
    expect(weeks[0][0].key).toBe("2026-09-28");
    expect(weeks[2][6].key).toBe("2026-10-18");
    expect(weeks[2][6].answers).toBe(3);
    expect(weeks[2][0].answers).toBe(2);
    expect(weeks[1][0].answers).toBe(7);
    expect(weeks.flat().some((c) => c.future)).toBe(false);
  });
  it("flags days after today in the current week", () => {
    const wed = new Date(2026, 9, 14, 12).getTime();
    const weeks = heatmapWeeks([], 1, wed);
    expect(weeks[0].map((c) => c.future)).toEqual([false, false, false, true, true, true, true]);
  });
  it("maps answers to 5 intensity steps", () => {
    expect([0, 1, 5, 10, 20].map((n) => heatLevel(n, 20))).toEqual([0, 1, 1, 2, 4]);
  });
});

const items: VocabItem[] = [1, 2, 3].map((n) => ({ id: `d:${n}`, deckId: "d", term: `t${n}`, definition: `d${n}` }));
const rev = (itemId: string, interval: number, lapses = 0, ease = 2.5): ReviewState => ({
  cardId: itemId, itemId, deckId: "d", direction: "forward", ease, interval, reps: 1, lapses, due: 0, introducedAt: 0, lastReviewed: 0
});

describe("deck progress and hard words", () => {
  it("splits cards into new / learning / mastered", () => {
    expect(deckProgress(items, [rev("d:1", 3), rev("d:2", 30)])).toEqual([
      { deckId: "d", total: 3, fresh: 1, learning: 1, mastered: 1 }
    ]);
  });
  it("ranks the most forgotten cards", () => {
    const hard = hardestWords(items, [rev("d:1", 1, 1), rev("d:2", 1, 3), rev("d:3", 10)]);
    expect(hard.map((h) => h.item.id)).toEqual(["d:2", "d:1"]);
  });
});
