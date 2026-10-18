import { describe, expect, it } from "vitest";
import { db } from "../src/db";
import { importBundle, importQcmExam, importSentenceDeck, importVocabDeck } from "../src/services/importer";
import { exportAllData } from "../src/services/exporter";
import type { QcmExamJson, SentenceDeckJson, VocabDeckJson } from "../src/types/json";

const vocab: VocabDeckJson = {
  type: "vocab_deck",
  id: "id-basics",
  title: "Basics",
  from: "id",
  to: "fr",
  items: [
    { id: "1", term: "makan", definition: "manger", tags: ["verbe"] },
    { id: "2", term: "minum", definition: "boire" }
  ]
};

const qcm: QcmExamJson = {
  type: "qcm_exam",
  id: "exam1",
  title: "Exam 1",
  durationSeconds: 60,
  questions: [
    {
      id: "q1",
      prompt: "2 + 2 ?",
      choices: [
        { id: "a", text: "3", correct: false },
        { id: "b", text: "4", correct: true }
      ]
    }
  ]
};

const sentences: SentenceDeckJson = {
  type: "sentence_deck",
  id: "s1",
  title: "Phrases",
  items: [
    { id: "1", text: "Saya makan nasi", translation: "Je mange du riz" },
    { id: "2", text: "Seul" } // < 2 tokens => ignored
  ]
};

describe("importer", () => {
  it("imports a vocab deck and is idempotent", async () => {
    await importVocabDeck(vocab);
    await importVocabDeck({ ...vocab, items: vocab.items.slice(0, 1) });
    expect(await db.vocabDecks.count()).toBe(1);
    const items = await db.vocabItems.toArray();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ deckId: "id-basics", term: "makan", tags: ["verbe"] });
  });

  it("imports a QCM exam", async () => {
    const r = await importQcmExam(qcm);
    expect(r.count).toBe(1);
    expect((await db.examQuestions.toArray())[0].examId).toBe("exam1");
  });

  it("imports sentences, tokenizes and skips single-word ones", async () => {
    const r = await importSentenceDeck(sentences);
    expect(r.count).toBe(1);
    const [s] = await db.sentenceExercises.toArray();
    expect(s.tokens).toEqual(["Saya", "makan", "nasi"]);
    expect(s.translation).toBe("Je mange du riz");
  });
});

describe("export / import round trip", () => {
  it("restores the same content", async () => {
    await importBundle({
      type: "revisions_bundle",
      schema: 1,
      exportedAt: 0,
      vocabDecks: [vocab],
      qcmExams: [qcm],
      sentenceDecks: [sentences]
    });
    const exported = await exportAllData();

    await Promise.all(db.tables.map((t) => t.clear()));
    await importBundle(exported);
    const again = await exportAllData();

    expect(again.vocabDecks).toEqual(exported.vocabDecks);
    expect(again.qcmExams).toEqual(exported.qcmExams);
    expect(again.sentenceDecks).toEqual(exported.sentenceDecks);
    expect(again.vocabDecks[0].items.map((i) => i.id)).toEqual(["1", "2"]);
  });
});
