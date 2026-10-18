import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validateImport } from "../src/services/validate";
import { importBundle } from "../src/services/importer";

describe("indo.json (bundle shipped on master)", () => {
  it("validates and imports", async () => {
    const json = JSON.parse(readFileSync(join(__dirname, "..", "indo.json"), "utf8"));
    const v = validateImport(json);
    expect(v.ok ? [] : v.errors).toEqual([]);
    if (v.ok && v.payload.type === "revisions_bundle") {
      const r = await importBundle(v.payload.data);
      expect(r.vocabItems).toBeGreaterThan(0);
    }
  });
});
