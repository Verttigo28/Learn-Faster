import { describe, expect, it } from "vitest";
import { buildVocabQuestion } from "../src/services/vocabQuiz";
import { buildPractice, gradePractice, type PracticeQuestion } from "../src/services/practice";
import { importQcmExam, importSentenceDeck, importVocabDeck } from "../src/services/importer";
import type { VocabItem } from "../src/db";

const items: VocabItem[] = ["a", "b", "c", "d", "e"].map((x) => ({
  id: `d:${x}`,
  deckId: "d",
  term: x,
  definition: x.toUpperCase()
}));

describe("buildVocabQuestion", () => {
  it("has exactly one correct option and the requested count", () => {
    const q = buildVocabQuestion(items, items[0], 4);
    expect(q.options).toHaveLength(4);
    expect(q.options.filter((o) => o.correct)).toEqual([{ id: "correct", text: "A", correct: true }]);
  });
});

describe("gradePractice", () => {
  it("grades MCQ and word-order questions", () => {
    const qs: PracticeQuestion[] = [
      { kind: "vocab_mcq", id: "1", prompt: "", options: [{ id: "x", text: "", correct: true }], answer: "x" },
      { kind: "exam_mcq", id: "2", prompt: "", options: [{ id: "y", text: "", correct: true }], answer: "z" },
      { kind: "sentence_order", id: "3", text: "a b", tokens: ["a", "b"], answer: ["a", "b"] }
    ];
    expect(gradePractice(qs)).toEqual({
      correct: 2,
      total: 3,
      score: 2 / 3,
      breakdown: { vocab: 1, exam: 1, order: 1 }
    });
  });
});

describe("buildPractice", () => {
  it("filters by tags and source, and caps the count", async () => {
    await importVocabDeck({
      type: "vocab_deck", id: "v", title: "V", from: "id", to: "fr",
      items: [
        { id: "1", term: "a", definition: "A", tags: ["t1"] },
        { id: "2", term: "b", definition: "B", tags: ["t2"] },
        { id: "3", term: "c", definition: "C", tags: ["t1"] }
      ]
    });
    await importQcmExam({
      type: "qcm_exam", id: "e", title: "E",
      questions: [{ id: "1", prompt: "?", choices: [{ id: "a", text: "a", correct: true }], tags: ["t1"] }]
    });
    await importSentenceDeck({ type: "sentence_deck", id: "s", title: "S", items: [{ id: "1", text: "x y", tags: ["t2"] }] });

    const onlyT1 = await buildPractice({ tags: ["t1"], count: 50, sources: ["vocab", "exam", "order"] });
    expect(onlyT1.map((q) => q.kind).sort()).toEqual(["exam_mcq", "vocab_mcq", "vocab_mcq"]);

    const capped = await buildPractice({ tags: [], count: 2, sources: [] });
    expect(capped).toHaveLength(2);
  });
});
