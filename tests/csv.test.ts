import { describe, expect, it } from "vitest";
import { detectDelimiter, parseDelimited, rowsToVocab } from "../src/utils/csv";
import { importVocabRows } from "../src/services/importer";
import { db } from "../src/db";

describe("csv parsing", () => {
  it("detects tab, semicolon and comma", () => {
    expect(detectDelimiter("a\tb\nc\td")).toBe("\t");
    expect(detectDelimiter("a;b, c\nd;e")).toBe(";");
    expect(detectDelimiter("a,b\nc,d")).toBe(",");
  });

  it("handles quotes, escaped quotes and CRLF", () => {
    expect(parseDelimited('a,"b, c","say ""hi"""\r\nd,e,f', ",")).toEqual([
      ["a", "b, c", 'say "hi"'],
      ["d", "e", "f"]
    ]);
  });

  it("converts an Anki export (directives, html, tags)", () => {
    const text = "#separator:tab\n#html:true\nmakan\t<b>manger</b>\tverbe repas\nminum\tboire\n\t\n";
    expect(rowsToVocab(text)).toEqual({
      rows: [
        { term: "makan", definition: "manger", tags: ["verbe", "repas"] },
        { term: "minum", definition: "boire", tags: [] }
      ],
      skipped: 0
    });
  });

  it("skips a header row and incomplete rows", () => {
    const r = rowsToVocab("terme;définition\nbesar;grand\nkecil;\n");
    expect(r.rows.map((x) => x.term)).toEqual(["besar"]);
    expect(r.skipped).toBe(1);
  });
});

describe("importVocabRows", () => {
  it("creates a deck, then appends without duplicates", async () => {
    const rows = [{ term: "a", definition: "A", tags: [] }, { term: "b", definition: "B", tags: [] }];
    const first = await importVocabRows({ title: "CSV", from: "id", to: "fr", rows });
    const again = await importVocabRows({ deckId: first.deckId, title: "CSV", from: "id", to: "fr", rows: [...rows, { term: "c", definition: "C", tags: [] }] });
    expect(first.added).toBe(2);
    expect(again).toMatchObject({ added: 1, duplicates: 2 });
    expect(await db.vocabItems.where("deckId").equals(first.deckId).count()).toBe(3);
    expect(await db.vocabDecks.count()).toBe(1);
  });
});
