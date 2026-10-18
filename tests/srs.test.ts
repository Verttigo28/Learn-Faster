import { describe, expect, it } from "vitest";
import { db } from "../src/db";
import { buildReviewQueue, cardId, DAY, newReview, schedule, formatInterval } from "../src/services/srs";
import { setSetting } from "../src/services/settings";
import { importBundle, importVocabDeck } from "../src/services/importer";
import { exportAllData } from "../src/services/exporter";
import type { VocabItem } from "../src/db";

const item: VocabItem = { id: "d:1", deckId: "d", term: "makan", definition: "manger" };
const NOW = new Date(2026, 9, 18, 12, 0, 0).getTime();

describe("schedule (SM-2)", () => {
  it("orders intervals Again < Hard <= Good < Easy for a new card", () => {
    const s = newReview(item);
    const due = [0, 1, 2, 3].map((g) => schedule(s, g as 0 | 1 | 2 | 3, NOW).due - NOW);
    expect(due[0]).toBe(10 * 60 * 1000);
    expect(due[1]).toBeLessThanOrEqual(due[2]);
    expect(due[2]).toBeLessThan(due[3]);
  });

  it("grows the interval on repeated Good answers", () => {
    let s = newReview(item);
    const intervals: number[] = [];
    for (let i = 0; i < 4; i++) {
      s = schedule(s, 2, NOW + i * DAY);
      intervals.push(s.interval);
    }
    expect(intervals).toEqual([1, 3, 8, 20]);
  });

  it("resets on Again and lowers ease, counting a lapse only after a success", () => {
    let s = schedule(newReview(item), 0, NOW);
    expect(s.lapses).toBe(0);
    s = schedule(schedule(s, 2, NOW), 0, NOW);
    expect(s).toMatchObject({ interval: 0, reps: 0, lapses: 1 });
    expect(s.ease).toBeCloseTo(2.1); // two "Again" answers
  });

  it("never lets ease go below 1.3", () => {
    let s = newReview(item);
    for (let i = 0; i < 20; i++) s = schedule(s, 1, NOW);
    expect(s.ease).toBe(1.3);
  });

  it("formats intervals", () => {
    const s = schedule(newReview(item), 0, NOW);
    expect(formatInterval(s, NOW)).toBe("10 min");
    expect(formatInterval(schedule(newReview(item), 3, NOW), NOW)).toBe("4 j");
  });

  it("records the introduction date once", () => {
    const first = schedule(newReview(item), 2, NOW);
    const second = schedule(first, 2, NOW + DAY);
    expect(second.introducedAt).toBe(NOW);
  });
});

describe("buildReviewQueue", () => {
  async function seed(n: number) {
    await importVocabDeck({
      type: "vocab_deck", id: "d", title: "D", from: "id", to: "fr",
      items: Array.from({ length: n }, (_, i) => ({ id: String(i), term: `t${i}`, definition: `d${i}` }))
    });
  }

  it("limits new cards per day and includes due cards first", async () => {
    await seed(10);
    await setSetting("newPerDay", 3);
    const items = await db.vocabItems.toArray();
    // one card due yesterday, one not due before next week
    await db.reviews.put({ ...schedule(newReview(items[0]), 2, NOW - 2 * DAY), introducedAt: NOW - 5 * DAY });
    await db.reviews.put({ ...schedule(newReview(items[1]), 3, NOW), introducedAt: NOW - 5 * DAY });

    const q = await buildReviewQueue({ now: NOW });
    expect(q[0].item.id).toBe(items[0].id);
    expect(q.filter((c) => c.isNew)).toHaveLength(3);
    expect(q.some((c) => c.item.id === items[1].id)).toBe(false);
  });

  it("subtracts new cards already introduced today", async () => {
    await seed(10);
    await setSetting("newPerDay", 3);
    const [a, b] = await db.vocabItems.toArray();
    await db.reviews.bulkPut([schedule(newReview(a), 3, NOW), schedule(newReview(b), 3, NOW)]);
    const q = await buildReviewQueue({ now: NOW + 1000 });
    expect(q.filter((c) => c.isNew)).toHaveLength(1);
  });

  it("tracks reverse direction separately", async () => {
    await seed(1);
    const [a] = await db.vocabItems.toArray();
    await db.reviews.put(schedule(newReview(a), 3, NOW));
    expect(await buildReviewQueue({ now: NOW })).toHaveLength(0);
    const rev = await buildReviewQueue({ now: NOW, direction: "reverse" });
    expect(rev.map((c) => c.review.cardId)).toEqual([cardId(a.id, "reverse")]);
  });
});

describe("SRS progress persistence", () => {
  it("keeps progress on re-import, drops it for removed items, and survives a bundle round trip", async () => {
    const deck = {
      type: "vocab_deck" as const, id: "d", title: "D", from: "id", to: "fr",
      items: [{ id: "1", term: "a", definition: "A" }, { id: "2", term: "b", definition: "B" }]
    };
    await importVocabDeck(deck);
    const items = await db.vocabItems.toArray();
    await db.reviews.bulkPut(items.map((it) => schedule(newReview(it), 2, NOW)));

    await importVocabDeck({ ...deck, items: deck.items.slice(0, 1) });
    expect((await db.reviews.toArray()).map((r) => r.itemId)).toEqual(["d:1"]);

    const bundle = await exportAllData();
    await Promise.all(db.tables.map((t) => t.clear()));
    await importBundle(bundle);
    expect(await db.reviews.count()).toBe(1);
  });
});
