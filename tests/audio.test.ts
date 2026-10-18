import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { audioKey, speechText } from "../src/services/piperCore";

const ROOT = join(__dirname, "..");
const AUDIO = join(ROOT, "public", "audio", "id");

/** Every Indonesian text of the starter packs (vocab terms + sentences). */
function packTexts(): string[] {
  const out = new Set<string>();
  const packs = join(ROOT, "public", "packs");
  for (const pack of readdirSync(packs)) {
    for (const sub of ["vocab", "phrases"]) {
      const dir = join(packs, pack, sub);
      if (!existsSync(dir)) continue;
      for (const f of readdirSync(dir)) {
        const doc = JSON.parse(readFileSync(join(dir, f), "utf8"));
        if (sub === "vocab" && doc.from !== "id") continue;
        for (const it of doc.items) out.add(speechText(sub === "vocab" ? it.term : it.text));
      }
    }
  }
  return [...out];
}

describe("recorded audio", () => {
  const manifest: { keys: string[]; license: string } = JSON.parse(readFileSync(join(AUDIO, "index.json"), "utf8"));
  const keys = new Set(manifest.keys);

  it("covers every Indonesian text of the starter packs (run `npm run audio`)", () => {
    const missing = packTexts().filter((text) => !keys.has(audioKey(text)));
    expect(missing).toEqual([]);
  });

  it("lists only files that exist, with a license notice", () => {
    expect(manifest.keys.filter((k) => !existsSync(join(AUDIO, `${k}.mp3`)))).toEqual([]);
    expect(manifest.license).toBe("CC-BY-NC-SA-4.0");
    expect(existsSync(join(AUDIO, "LICENSE.md"))).toBe(true);
  });
});
