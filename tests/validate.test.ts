import { describe, expect, it } from "vitest";
import { validateImport } from "../src/services/validate";

describe("validateImport", () => {
  it("accepts a valid vocab deck", () => {
    const r = validateImport({ type: "vocab_deck", id: "d", title: "D", from: "id", to: "fr", items: [{ id: "1", term: "a", definition: "b" }] });
    expect(r.ok).toBe(true);
  });

  it("reports precise paths for bad items", () => {
    const r = validateImport({
      type: "vocab_deck", id: "d", title: "D", from: "id", to: "fr",
      items: [{ id: "1", term: "a", definition: "b" }, { id: "1", term: "", definition: 3 }]
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors).toEqual([
      "items[1].term : texte non vide requis",
      "items[1].definition : texte non vide requis",
      'items[1].id : id "1" en double'
    ]);
  });

  it("requires a correct choice in QCM questions", () => {
    const r = validateImport({
      type: "qcm_exam", id: "e", title: "E",
      questions: [{ id: "q", prompt: "?", choices: [{ id: "a", text: "a", correct: false }, { id: "b", text: "b", correct: false }] }]
    });
    expect(r.ok ? [] : r.errors).toEqual(["questions[0].choices : aucun choix correct"]);
  });

  it("validates nested bundle content and tolerates missing sections", () => {
    const bad = validateImport({ type: "revisions_bundle", schema: 1, vocabDecks: [{ type: "vocab_deck", id: "x" }] });
    expect(bad.ok).toBe(false);

    const ok = validateImport({ type: "revisions_bundle", schema: 1, vocabDecks: [] });
    expect(ok.ok && ok.payload.type === "revisions_bundle" && ok.payload.data.qcmExams).toEqual([]);
  });

  it("rejects unknown types", () => {
    expect(validateImport({ type: "nope" }).ok).toBe(false);
    expect(validateImport([]).ok).toBe(false);
  });
});

describe("validateImport top-level paths", () => {
  it("keeps the first character of root keys", () => {
    const r = validateImport({ type: "revisions_bundle", schema: 2 });
    expect(r.ok ? [] : r.errors).toEqual(["schema : version 1 attendue"]);
  });
});
