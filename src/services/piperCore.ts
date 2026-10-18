/**
 * Piper neural TTS core (no imports): text -> phoneme ids (eSpeak NG compiled to WebAssembly)
 * -> ONNX VITS model -> PCM samples.
 *
 * Shared by the app (src/services/piper.ts) and the audio build script (scripts/generate-audio.mjs),
 * which bundles this file with esbuild and runs it in headless Chromium.
 */

/** Emscripten factory exposed by @diffusionstudio/piper-wasm (global `createPiperPhonemize`). */
export type PhonemizeFactory = (module: {
  print: (line: string) => void;
  printErr: (line: string) => void;
  locateFile: (file: string) => string;
}) => Promise<{ callMain: (args: string[]) => void }>;

/** Minimal surface of onnxruntime-web used here. */
export type OrtLike = {
  Tensor: new (type: string, data: unknown, dims: number[]) => unknown;
  InferenceSession: { create: (model: ArrayBuffer | Uint8Array) => Promise<OrtSession> };
};
export type OrtSession = { run: (feeds: Record<string, unknown>) => Promise<Record<string, { data: unknown }>> };

/** The voice's .onnx.json config (subset). */
export type PiperConfig = {
  audio: { sample_rate: number };
  espeak: { voice: string };
  inference: { noise_scale: number; length_scale: number; noise_w: number };
  num_speakers?: number;
};

/** Pinned so the app and the build script produce the same pronunciation. */
export const PIPER_WASM_BASE = "https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize";

/** Indonesian voice: rhasspy/piper-voices "news_tts" (training data CC-BY-NC-SA 4.0, see public/audio/id/LICENSE.md). */
export const PIPER_VOICES: Record<string, { model: string; config: string; label: string }> = {
  id: {
    model: "https://huggingface.co/rhasspy/piper-voices/resolve/main/id/id_ID/news_tts/medium/id_ID-news_tts-medium.onnx",
    config: "https://huggingface.co/rhasspy/piper-voices/resolve/main/id/id_ID/news_tts/medium/id_ID-news_tts-medium.onnx.json",
    label: "id_ID-news_tts-medium"
  }
};

/** Text sent to the synthesizer: same key normalization as the recorded audio. */
export function speechText(text: string): string {
  return text.normalize("NFC").replace(/\s+/g, " ").trim();
}

/** Stable file key for a text (cyrb53 hash, base 36): recorded audio lives at audio/<lang>/<key>.mp3. */
export function audioKey(text: string): string {
  const str = speechText(text);
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** Phoneme ids for one text (a fresh WebAssembly instance per call: the CLI exits after each run). */
export function phonemize(factory: PhonemizeFactory, text: string, espeakVoice: string, wasmBase = PIPER_WASM_BASE): Promise<number[]> {
  return new Promise((resolve, reject) => {
    let done = false;
    factory({
      print: (line) => {
        if (done) return;
        try {
          done = true;
          resolve(JSON.parse(line).phoneme_ids as number[]);
        } catch (e) {
          reject(e);
        }
      },
      printErr: (line) => {
        if (!done && /error/i.test(line)) {
          done = true;
          reject(new Error(line));
        }
      },
      locateFile: (file) => (file.endsWith(".wasm") ? `${wasmBase}.wasm` : file.endsWith(".data") ? `${wasmBase}.data` : file)
    })
      .then((m) => m.callMain(["-l", espeakVoice, "--input", JSON.stringify([{ text }]), "--espeak_data", "/espeak-ng-data"]))
      .catch(reject);
  });
}

/** Runs the VITS model on phoneme ids and returns mono float samples in [-1, 1]. */
export async function synthesize(ort: OrtLike, session: OrtSession, config: PiperConfig, ids: number[]): Promise<Float32Array> {
  const { noise_scale, length_scale, noise_w } = config.inference;
  const feeds: Record<string, unknown> = {
    input: new ort.Tensor("int64", BigInt64Array.from(ids.map((n) => BigInt(n))), [1, ids.length]),
    input_lengths: new ort.Tensor("int64", BigInt64Array.from([BigInt(ids.length)]), [1]),
    scales: new ort.Tensor("float32", Float32Array.from([noise_scale, length_scale, noise_w]), [3])
  };
  if ((config.num_speakers ?? 1) > 1) feeds.sid = new ort.Tensor("int64", BigInt64Array.from([0n]), [1]);
  const out = await session.run(feeds);
  return out.output.data as Float32Array;
}

/** Trims near-silent edges so short words play instantly. */
export function trimSilence(samples: Float32Array, threshold = 0.01, padding = 800): Float32Array {
  let start = 0;
  let end = samples.length - 1;
  while (start < end && Math.abs(samples[start]) < threshold) start++;
  while (end > start && Math.abs(samples[end]) < threshold) end--;
  return samples.subarray(Math.max(0, start - padding), Math.min(samples.length, end + padding));
}

/** 16-bit PCM WAV. */
export function toWav(samples: Float32Array, sampleRate: number): Blob {
  const buf = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const str = (o: number, s: string) => [...s].forEach((c, i) => buf.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  buf.setUint32(4, 36 + samples.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  buf.setUint32(16, 16, true);
  buf.setUint16(20, 1, true);
  buf.setUint16(22, 1, true);
  buf.setUint32(24, sampleRate, true);
  buf.setUint32(28, sampleRate * 2, true);
  buf.setUint16(32, 2, true);
  buf.setUint16(34, 16, true);
  str(36, "data");
  buf.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf.buffer], { type: "audio/wav" });
}
