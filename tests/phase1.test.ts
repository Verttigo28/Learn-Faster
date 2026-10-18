import { describe, expect, it } from "vitest";
import Dexie from "dexie";
import { AppDB, db } from "../src/db";
import { importBundle, importSentenceDeck, importVocabDeck } from "../src/services/importer";
import { exportAllData } from "../src/services/exporter";
import { buildVocabQuestion } from "../src/services/vocabQuiz";
import { buildPractice } from "../src/services/practice";
import { getAllTags } from "../src/services/tags";
import { addSentence } from "../src/services/sentences";
import { shuffleTokens } from "../src/utils/sentence";
import type { VocabItem } from "../src/db";

describe("vocab question distractors", () => {
  it("never repeats the correct definition or a distractor", () => {
    const items: VocabItem[] = [
      { id: "d:1", deckId: "d", term: "besar", definition: "grand" },
      { id: "d:2", deckId: "d", term: "raya", definition: "Grand" },
      { id: "d:3", deckId: "d", term: "kecil", definition: "petit" },
      { id: "d:4", deckId: "d", term: "mungil", definition: "petit" },
      { id: "d:5", deckId: "d", term: "baru", definition: "nouveau" }
    ];
    for (let i = 0; i < 50; i++) {
      const q = buildVocabQuestion(items, items[0], 4);
      const texts = q.options.map((o) => o.text.toLowerCase());
      expect(new Set(texts).size).toBe(texts.length);
      expect(q.options).toHaveLength(3); // grand, petit, nouveau
    }
  });

  it("practice picks distractors from the same deck", async () => {
    const mk = (id: string, prefix: string) => ({
      type: "vocab_deck" as const, id, title: id, from: "x", to: "y",
      items: [1, 2, 3, 4].map((n) => ({ id: String(n), term: `${prefix}${n}`, definition: `${prefix}-def${n}` }))
    });
    await importVocabDeck(mk("id", "id"));
    await importVocabDeck(mk("es", "es"));
    const qs = await buildPractice({ tags: [], count: 50, sources: ["vocab"] });
    for (const q of qs) {
      if (q.kind !== "vocab_mcq") continue;
      const prefix = q.id.split(":")[0];
      for (const o of q.options) expect(o.text.startsWith(`${prefix}-`)).toBe(true);
    }
  });
});

describe("ids containing ':'", () => {
  it("re-import does not wipe a deck whose id shares the prefix", async () => {
    const deck = (id: string) => ({
      type: "vocab_deck" as const, id, title: id, from: "a", to: "b",
      items: [{ id: "1", term: "t", definition: "d" }]
    });
    await importVocabDeck(deck("a:b"));
    await importVocabDeck(deck("a"));
    await importVocabDeck(deck("a")); // re-import
    expect(await db.vocabItems.where("deckId").equals("a:b").count()).toBe(1);

    const exported = await exportAllData();
    const ab = exported.vocabDecks.find((d) => d.id === "a:b")!;
    expect(ab.items[0].id).toBe("1");
  });
});

describe("sentence decks", () => {
  it("keeps the deck title through export / import", async () => {
    await importSentenceDeck({ type: "sentence_deck", id: "s1", title: "Au marché", items: [{ id: "1", text: "Berapa harganya ini" }] });
    await addSentence({ deckTitle: "", text: "Saya suka kopi", tags: ["x"] });
    const exported = await exportAllData();
    expect(exported.sentenceDecks.map((d) => d.title).sort()).toEqual(["Au marché", "Mes phrases"]);

    await Promise.all(db.tables.map((t) => t.clear()));
    await importBundle(exported);
    expect((await db.sentenceDecks.toArray()).map((d) => d.title).sort()).toEqual(["Au marché", "Mes phrases"]);
    expect(await db.sentenceExercises.count()).toBe(2);
  });
});

describe("tags index", () => {
  it("lists unique tags across all content", async () => {
    await importVocabDeck({ type: "vocab_deck", id: "v", title: "v", from: "a", to: "b", items: [{ id: "1", term: "t", definition: "d", tags: ["b", "a"] }] });
    await addSentence({ deckTitle: "x", text: "a b", tags: ["c", "a"] });
    expect(await getAllTags()).toEqual(["a", "b", "c"]);
  });
});

describe("shuffleTokens", () => {
  it("avoids returning the solved order", () => {
    for (let i = 0; i < 50; i++) expect(shuffleTokens(["a", "b"])).toEqual(["b", "a"]);
  });
  it("still works when all tokens are equal", () => {
    expect(shuffleTokens(["a", "a"])).toEqual(["a", "a"]);
  });
});

describe("migration v3 -> v4", () => {
  it("assigns decks to existing sentences", async () => {
    const name = "migration_test";
    const old = new Dexie(name);
    old.version(3).stores({
      vocabDecks: "id, title, createdAt",
      vocabItems: "id, deckId",
      exams: "id, title, createdAt",
      examQuestions: "id, examId",
      sentenceExercises: "id, createdAt",
      attempts: "id, type, refId, startedAt, finishedAt"
    });
    await old.table("sentenceExercises").bulkAdd([
      { id: "trip:1", text: "a b", tokens: ["a", "b"], createdAt: 1 },
      { id: "sent_x", text: "c d", tokens: ["c", "d"], createdAt: 2 }
    ]);
    old.close();

    const next = new AppDB(name);
    const sentences = await next.sentenceExercises.toArray();
    expect(Object.fromEntries(sentences.map((s) => [s.id, s.deckId]))).toEqual({ "trip:1": "trip", sent_x: "manual" });
    expect((await next.sentenceDecks.toArray()).map((d) => d.id).sort()).toEqual(["manual", "trip"]);
    next.close();
    await Dexie.delete(name);
  });
});

describe("empty sentence decks", () => {
  it("are kept in the export", async () => {
    await importSentenceDeck({ type: "sentence_deck", id: "empty", title: "Vide", items: [] });
    const exported = await exportAllData();
    expect(exported.sentenceDecks).toEqual([{ type: "sentence_deck", id: "empty", title: "Vide", items: [] }]);
  });
});

describe("migration from the master build (v4 srsCards)", () => {
  it("keeps sentences and converts vocab SRS cards into reviews", async () => {
    const name = "migration_master_v4";
    const old = new Dexie(name);
    old.version(4).stores({
      vocabDecks: "id, title, createdAt",
      vocabItems: "id, deckId",
      exams: "id, title, createdAt",
      examQuestions: "id, examId",
      sentenceExercises: "id, createdAt",
      srsCards: "id, itemId, itemType, nextReview",
      attempts: "id, type, refId, startedAt, finishedAt"
    });
    await old.table("vocabItems").add({ id: "d:1", deckId: "d", term: "makan", definition: "manger" });
    await old.table("sentenceExercises").add({ id: "trip:1", text: "a b", tokens: ["a", "b"], createdAt: 1 });
    await old.table("srsCards").bulkAdd([
      { id: "srs:d:1", itemId: "d:1", itemType: "vocab", easeFactor: 2.36, interval: 6, repetitions: 2, nextReview: 123, lastReview: 100 },
      { id: "srs:gone", itemId: "gone", itemType: "vocab", easeFactor: 2.5, interval: 1, repetitions: 1, nextReview: 1, lastReview: 1 },
      { id: "srs:q", itemId: "e:1", itemType: "exam", easeFactor: 2.5, interval: 1, repetitions: 1, nextReview: 1, lastReview: 1 }
    ]);
    old.close();

    const next = new AppDB(name);
    expect(await next.reviews.toArray()).toEqual([
      {
        cardId: "d:1", itemId: "d:1", deckId: "d", direction: "forward",
        ease: 2.36, interval: 6, reps: 2, lapses: 0, due: 123, introducedAt: 100, lastReviewed: 100
      }
    ]);
    expect((await next.sentenceExercises.get("trip:1"))?.deckId).toBe("trip");
    next.close();
    await Dexie.delete(name);
  });
});
