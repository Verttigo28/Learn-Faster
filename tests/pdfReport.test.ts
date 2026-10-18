import { describe, expect, it } from "vitest";
import { buildReport, pdfSafe } from "../src/services/pdfReport";
import type { Attempt } from "../src/db";

describe("pdfSafe", () => {
  it("keeps French accents and maps typographic punctuation", () => {
    expect(pdfSafe("L’été — déjà…")).toBe("L'été - déjà...");
  });
  it("replaces characters outside Latin-1", () => {
    expect(pdfSafe("こんにちは ok")).toBe("????? ok");
  });
});

describe("buildReport", () => {
  it("describes each detail with its status", () => {
    const attempt: Attempt = {
      id: "a", type: "practice", refId: "practice", startedAt: 0, finishedAt: 0, score: 0.5,
      meta: {
        total: 2, correct: 1, durationSeconds: 30,
        details: [
          { kind: "exam_mcq", id: "1", prompt: "2+2", options: [{ id: "a", text: "4", correct: true }], pickedId: "a", correct: true, explanation: "facile" },
          { kind: "sentence_order", id: "2", text: "a b", tokens: ["a", "b"], answer: ["b", "a"], correct: false }
        ]
      }
    };
    const r = buildReport(attempt, "Test");
    expect(r.title).toBe("Résultats — Test");
    expect(r.meta).toContain("Durée : 1 min");
    expect(r.blocks.map((b) => [b.label, b.status])).toEqual([["QCM", "OK"], ["Phrase", "Faux"]]);
    expect(r.blocks[0].lines.at(-1)).toEqual({ label: "Explication", text: "facile" });
    expect(r.blocks[1].lines).toContainEqual({ label: "Ta réponse", text: "b a" });
  });
});

describe("renderPdf", () => {
  it("produces a multi-page PDF", async () => {
    const { renderPdf } = await import("../src/services/pdfReport");
    const blocks = Array.from({ length: 60 }, (_, i) => ({
      index: i + 1, label: "Vocab", correct: i % 2 === 0, status: "OK",
      lines: [{ label: "Question", text: "Traduction de « makan » — très long texte ".repeat(4) }]
    }));
    const blob = await renderPdf({ title: "Résultats — été", meta: ["Score : 50%"], blocks });
    const text = new TextDecoder("latin1").decode(await blob.arrayBuffer());
    expect(text.startsWith("%PDF-")).toBe(true);
    expect((text.match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(1);
  });
});
