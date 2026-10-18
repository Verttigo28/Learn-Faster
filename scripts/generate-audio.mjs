// Pre-records Indonesian audio for the starter packs with the Piper neural voice, so the app can play
// words and sentences instantly and offline, without any voice installed on the device.
//
//   npm run audio            # generate missing files only (incremental)
//   npm run audio -- --force # regenerate everything
//   npm run audio -- --limit 20 --out <dir>   # quick trial
//
// Runs src/services/piperCore.ts (bundled with esbuild) inside headless Chromium via Playwright,
// encodes MP3 (mono, 32 kbps) with lamejs and writes public/audio/id/<key>.mp3 + index.json.
import { build } from "esbuild";
import { chromium } from "@playwright/test";
import { Mp3Encoder } from "@breezystack/lamejs";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const force = args.includes("--force");
const limit = Number(arg("limit") ?? Infinity);
const outDir = arg("out") ?? join(root, "public", "audio", "id");
const ORT_VERSION = JSON.parse(readFileSync(join(root, "node_modules/onnxruntime-web/package.json"), "utf8")).version;

// ---- collect every Indonesian text of the packs -------------------------------------------------
const { audioKey, speechText, PIPER_VOICES } = await import("data:text/javascript;base64," +
  Buffer.from((await build({ entryPoints: [join(root, "src/services/piperCore.ts")], bundle: true, format: "esm", write: false })).outputFiles[0].text).toString("base64"));

const texts = new Map(); // key -> text
const packsDir = join(root, "public", "packs");
for (const pack of readdirSync(packsDir)) {
  for (const sub of ["vocab", "phrases"]) {
    const dir = join(packsDir, pack, sub);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      const doc = JSON.parse(readFileSync(join(dir, f), "utf8"));
      if (sub === "vocab" && doc.from !== "id") continue;
      for (const it of doc.items) {
        const t = speechText(sub === "vocab" ? it.term : it.text);
        if (t) texts.set(audioKey(t), t);
      }
    }
  }
}
console.log(`${texts.size} unique Indonesian texts`);

mkdirSync(outDir, { recursive: true });
const todo = [...texts].filter(([key]) => force || !existsSync(join(outDir, `${key}.mp3`))).slice(0, limit);
console.log(`${todo.length} to generate`);

// ---- synthesis in headless Chromium -------------------------------------------------------------
const coreIife = (await build({
  entryPoints: [join(root, "src/services/piperCore.ts")],
  bundle: true,
  format: "iife",
  globalName: "PiperCore",
  write: false
})).outputFiles[0].text;

if (todo.length) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.route("https://tts.local/**", (route) =>
    route.fulfill({ contentType: "text/html", body: "<!doctype html><meta charset=utf-8><title>tts</title>" })
  );
  await page.goto("https://tts.local/");
  await page.addScriptTag({ url: `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/ort.wasm.min.js` });
  await page.addScriptTag({ url: "https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize.js" });
  await page.addScriptTag({ content: coreIife });

  const voice = PIPER_VOICES.id;
  const sampleRate = await page.evaluate(async ({ voice, ortVersion }) => {
    const ort = window.ort;
    ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ortVersion}/dist/`;
    ort.env.wasm.numThreads = 1;
    const config = await (await fetch(voice.config)).json();
    const model = new Uint8Array(await (await fetch(voice.model)).arrayBuffer());
    window.__tts = { ort, config, session: await ort.InferenceSession.create(model) };
    return config.audio.sample_rate;
  }, { voice, ortVersion: ORT_VERSION });
  console.log(`voice loaded (${sampleRate} Hz)`);

  const started = Date.now();
  let done = 0;
  for (const [key, text] of todo) {
    const pcm = await page.evaluate(async (text) => {
      const { ort, config, session } = window.__tts;
      const core = window.PiperCore;
      const ids = await core.phonemize(window.createPiperPhonemize, text, config.espeak.voice);
      const samples = core.trimSilence(await core.synthesize(ort, session, config, ids));
      const int16 = new Int16Array(samples.length);
      for (let i = 0; i < samples.length; i++) int16[i] = Math.max(-1, Math.min(1, samples[i])) * 0x7fff;
      // base64 transfer is much faster than a huge JSON number array
      let bin = "";
      const bytes = new Uint8Array(int16.buffer);
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return btoa(bin);
    }, text);

    const int16 = new Int16Array(Uint8Array.from(Buffer.from(pcm, "base64")).buffer);
    const enc = new Mp3Encoder(1, sampleRate, 32);
    const chunks = [];
    for (let i = 0; i < int16.length; i += 1152) {
      const out = enc.encodeBuffer(int16.subarray(i, i + 1152));
      if (out.length) chunks.push(Buffer.from(out));
    }
    const end = enc.flush();
    if (end.length) chunks.push(Buffer.from(end));
    writeFileSync(join(outDir, `${key}.mp3`), Buffer.concat(chunks));

    done++;
    if (done % 50 === 0 || done === todo.length) {
      const rate = (Date.now() - started) / done;
      console.log(`${done}/${todo.length} — ${Math.round(rate)} ms/item, ~${Math.round(((todo.length - done) * rate) / 60000)} min left`);
    }
  }
  await browser.close();
}

// ---- manifest -----------------------------------------------------------------------------------
const files = readdirSync(outDir).filter((f) => f.endsWith(".mp3")).map((f) => f.slice(0, -4)).sort();
writeFileSync(
  join(outDir, "index.json"),
  JSON.stringify({
    voice: PIPER_VOICES.id.label,
    license: "CC-BY-NC-SA-4.0",
    attribution: "Generated with Piper TTS (rhasspy/piper-voices id_ID news_tts). See LICENSE.md.",
    keys: files
  }) + "\n"
);
console.log(`index.json: ${files.length} recordings`);
