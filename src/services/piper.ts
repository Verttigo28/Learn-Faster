/**
 * In-browser neural voice (Piper) for words that have no pre-recorded audio, so learners never have to
 * install a system voice. Everything downloads automatically on first use (≈ 80 MB for Indonesian:
 * voice model + eSpeak data + ONNX runtime) and is cached for offline use.
 */
import {
  PIPER_VOICES,
  PIPER_WASM_BASE,
  phonemize,
  speechText,
  synthesize,
  toWav,
  trimSilence,
  type OrtLike,
  type OrtSession,
  type PhonemizeFactory,
  type PiperConfig
} from "./piperCore";

/** Must match the installed onnxruntime-web version (checked by tests/piper.test.ts). */
export const ORT_VERSION = "1.30.0";
const ORT_WASM_PATH = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;
const CACHE_NAME = "piper-voices-v1";

export type Progress = { loaded: number; total: number };

export function hasNeuralVoice(base: string): boolean {
  return base in PIPER_VOICES && typeof WebAssembly !== "undefined";
}

let phonemizer: Promise<PhonemizeFactory> | null = null;
function loadPhonemizer(): Promise<PhonemizeFactory> {
  phonemizer ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `${PIPER_WASM_BASE}.js`;
    s.async = true;
    s.onload = () => {
      const f = (window as unknown as { createPiperPhonemize?: PhonemizeFactory }).createPiperPhonemize;
      if (f) resolve(f);
      else reject(new Error("phonemizer not available"));
    };
    s.onerror = () => {
      phonemizer = null;
      reject(new Error("phonemizer download failed"));
    };
    document.head.appendChild(s);
  });
  return phonemizer;
}

let ortPromise: Promise<OrtLike> | null = null;
function loadOrt(): Promise<OrtLike> {
  ortPromise ??= import("onnxruntime-web/wasm").then((ort) => {
    ort.env.wasm.wasmPaths = ORT_WASM_PATH;
    ort.env.wasm.numThreads = 1; // threads need cross-origin isolation (not available on static hosting)
    return ort as unknown as OrtLike;
  });
  return ortPromise;
}

/** Fetch with progress, kept in the Cache API so the voice works offline afterwards. */
async function cachedFetch(url: string, onProgress?: (p: Progress) => void): Promise<ArrayBuffer> {
  const cache = typeof caches !== "undefined" ? await caches.open(CACHE_NAME).catch(() => null) : null;
  const hit = await cache?.match(url);
  if (hit) return hit.arrayBuffer();

  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`${url}: HTTP ${res.status}`);
  const total = Number(res.headers.get("Content-Length") ?? 0);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onProgress?.({ loaded, total });
  }
  const buf = new Uint8Array(loaded);
  let offset = 0;
  for (const c of chunks) {
    buf.set(c, offset);
    offset += c.length;
  }
  await cache?.put(url, new Response(buf, { headers: { "Content-Type": "application/octet-stream" } })).catch(() => {});
  return buf.buffer;
}

type Voice = { session: OrtSession; config: PiperConfig; ort: OrtLike };
const voices = new Map<string, Promise<Voice>>();

/** Downloads (once) and initializes the voice for a language. */
export function prepareVoice(base: string, onProgress?: (p: Progress) => void): Promise<Voice> {
  const existing = voices.get(base);
  if (existing) return existing;
  const v = PIPER_VOICES[base];
  if (!v) return Promise.reject(new Error(`no neural voice for ${base}`));
  const p = (async () => {
    const [ort, config, model] = await Promise.all([
      loadOrt(),
      cachedFetch(v.config).then((b) => JSON.parse(new TextDecoder().decode(b)) as PiperConfig),
      cachedFetch(v.model, onProgress),
      loadPhonemizer()
    ]);
    return { ort, config, session: await ort.InferenceSession.create(new Uint8Array(model)) };
  })();
  p.catch(() => voices.delete(base)); // allow a retry (e.g. back online)
  voices.set(base, p);
  return p;
}

/** True when the voice model is already downloaded (no big download on next use). */
export async function isVoiceCached(base: string): Promise<boolean> {
  const v = PIPER_VOICES[base];
  if (!v || typeof caches === "undefined") return false;
  const cache = await caches.open(CACHE_NAME).catch(() => null);
  return !!(await cache?.match(v.model));
}

const memo = new Map<string, Blob>();

/** WAV audio for a text, synthesized locally. */
export async function synthesizeWav(text: string, base: string, onProgress?: (p: Progress) => void): Promise<Blob> {
  const key = `${base}:${speechText(text)}`;
  const hit = memo.get(key);
  if (hit) return hit;
  const voice = await prepareVoice(base, onProgress);
  const factory = await loadPhonemizer();
  const ids = await phonemize(factory, speechText(text), voice.config.espeak.voice);
  const samples = trimSilence(await synthesize(voice.ort, voice.session, voice.config, ids));
  const wav = toWav(samples, voice.config.audio.sample_rate);
  if (memo.size > 100) memo.delete(memo.keys().next().value as string);
  memo.set(key, wav);
  return wav;
}
