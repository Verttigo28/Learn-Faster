import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { validateImport } from "../src/services/validate";
import { tokenizeSentence } from "../src/utils/sentence";
import type { PackInfo } from "../src/services/packs";

const PACKS = join(__dirname, "..", "public", "packs");
const manifest: { packs: PackInfo[] } = JSON.parse(readFileSync(join(PACKS, "index.json"), "utf8"));

describe("starter packs", () => {
  it("manifest is in sync with the pack folders (run `npm run packs`)", () => {
    for (const pack of manifest.packs) {
      const dir = pack.files[0].split("/")[0];
      const onDisk = ["vocab", "qcm", "phrases"].flatMap((sub) =>
        existsSync(join(PACKS, dir, sub))
          ? readdirSync(join(PACKS, dir, sub)).filter((f) => f.endsWith(".json")).map((f) => `${dir}/${sub}/${f}`)
          : []
      );
      expect([...pack.files].sort()).toEqual(onDisk.sort());
    }
  });

  for (const pack of manifest.packs) {
    describe(pack.id, () => {
      const docs = pack.files.map((f) => ({ file: f, json: JSON.parse(readFileSync(join(PACKS, f), "utf8")) }));

      it("every file passes the import validator", () => {
        const failures = docs.flatMap(({ file, json }) => {
          const v = validateImport(json);
          return v.ok ? [] : [`${file}: ${v.errors.slice(0, 3).join("; ")}`];
        });
        expect(failures).toEqual([]);
      });

      it("ids are unique across the pack", () => {
        const ids = docs.map(({ json }) => `${json.type}:${json.id}`);
        expect(ids.length).toBe(new Set(ids).size);
      });

      it("sentences are usable by the word-order exercise", () => {
        const bad = docs
          .filter(({ json }) => json.type === "sentence_deck")
          .flatMap(({ file, json }) =>
            (json.items as { id: string; text: string }[])
              .filter((s) => tokenizeSentence(s.text).length < 2)
              .map((s) => `${file}#${s.id}`)
          );
        expect(bad).toEqual([]);
      });

      it("matches the counts in the manifest", () => {
        const count = (type: string, key: string) =>
          docs.filter(({ json }) => json.type === type).reduce((n, { json }) => n + json[key].length, 0);
        expect(count("vocab_deck", "items")).toBe(pack.counts.vocabItems);
        expect(count("qcm_exam", "questions")).toBe(pack.counts.questions);
        expect(count("sentence_deck", "items")).toBe(pack.counts.sentences);
      });
    });
  }
});
