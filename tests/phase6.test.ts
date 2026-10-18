import { describe, expect, it } from "vitest";
import { searchAll } from "../src/services/search";
import { importQcmExam, importSentenceDeck, importVocabDeck } from "../src/services/importer";
import { makeCloze, BLANK } from "../src/utils/cloze";
import { buildPractice, gradePractice } from "../src/services/practice";

async function seed() {
  await importVocabDeck({ type: "vocab_deck", id: "v", title: "Repas", from: "id", to: "fr", items: [{ id: "1", term: "makan", definition: "manger", tags: ["verbe"] }] });
  await importQcmExam({ type: "qcm_exam", id: "e", title: "Gram", questions: [{ id: "1", prompt: "Négation de makan ?", choices: [{ id: "a", text: "tidak makan", correct: true }, { id: "b", text: "x", correct: false }] }] });
  await importSentenceDeck({ type: "sentence_deck", id: "s", title: "Phrases", items: [{ id: "1", text: "Saya mau makan nasi.", translation: "Je veux manger du riz" }] });
}

describe("searchAll", () => {
  it("finds content across types, ignoring accents and case", async () => {
    await seed();
    const hits = await searchAll("MAKAN");
    expect(hits.map((h) => h.kind).sort()).toEqual(["qcm", "sentence", "vocab"]);
    expect((await searchAll("negation")).map((h) => h.kind)).toEqual(["qcm"]);
    expect(await searchAll("m")).toEqual([]);
    expect((await searchAll("verbe"))[0].link).toBe("/vocab/v/edit");
  });
});

describe("cloze", () => {
  it("blanks one long word and keeps punctuation", () => {
    for (let i = 0; i < 20; i++) {
      const c = makeCloze(["Saya", "mau", "makan", "nasi."])!;
      expect(c.answer.length).toBeGreaterThanOrEqual(4);
      expect(c.display).toContain(BLANK);
      expect(c.display.replace(BLANK, c.answer)).toBe("Saya mau makan nasi.");
    }
  });
  it("returns null when nothing can be blanked", () => {
    expect(makeCloze(["a"])).toBeNull();
  });
});

describe("practice typed kinds", () => {
  it("builds typed, cloze and dictation questions and grades them", async () => {
    await seed();
    const qs = await buildPractice({ tags: [], count: 10, sources: ["typed", "cloze", "dictation"] });
    expect(qs.map((q) => q.kind).sort()).toEqual(["cloze", "dictation", "vocab_typed"]);
    for (const q of qs) if ("expected" in q) q.answer = q.expected.toUpperCase();
    expect(gradePractice(qs)).toMatchObject({ correct: 3, total: 3, breakdown: { typed: 1, cloze: 1, dictation: 1 } });
  });

  it("asks the reverse direction when requested", async () => {
    await seed();
    const [q] = await buildPractice({ tags: [], count: 1, sources: ["typed"], vocabDirection: "reverse" });
    expect(q.kind === "vocab_typed" && q.expected).toBe("makan");
  });
});
