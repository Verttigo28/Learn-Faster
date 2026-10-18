import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { audioKey, speechText, toWav, trimSilence } from "../src/services/piperCore";
import { ORT_VERSION } from "../src/services/piper";

describe("piper core", () => {
  it("pins the CDN runtime to the installed onnxruntime-web version", () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, "..", "node_modules/onnxruntime-web/package.json"), "utf8"));
    expect(ORT_VERSION).toBe(pkg.version);
  });

  it("derives stable audio keys from normalized text", () => {
    expect(speechText("  Apa   kabar? ")).toBe("Apa kabar?");
    expect(audioKey("Apa kabar?")).toBe(audioKey(" Apa  kabar? "));
    expect(audioKey("makan")).not.toBe(audioKey("minum"));
    expect(audioKey("makan")).toMatch(/^[0-9a-z]+$/);
  });

  it("trims silent edges and keeps a little padding", () => {
    const s = new Float32Array(10_000);
    s.fill(0.5, 4000, 5000);
    const out = trimSilence(s, 0.01, 100);
    expect(out.length).toBe(1000 + 2 * 100 - 1);
  });

  it("writes a valid 16-bit mono WAV header", async () => {
    const wav = toWav(new Float32Array([0, 1, -1]), 22050);
    const v = new DataView(await wav.arrayBuffer());
    const tag = (o: number) => String.fromCharCode(...[0, 1, 2, 3].map((i) => v.getUint8(o + i)));
    expect(tag(0)).toBe("RIFF");
    expect(tag(8)).toBe("WAVE");
    expect(v.getUint32(24, true)).toBe(22050);
    expect(v.getUint32(40, true)).toBe(6);
    expect(v.getInt16(46, true)).toBe(32767);
  });
});
