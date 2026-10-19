import { intlLocale, t } from "../i18n";
import { toast } from "./dialog";
import { recordedUrl } from "./recordedAudio";
import { hasNeuralVoice, isVoiceCached, synthesizeWav } from "./piper";

/**
 * Pronunciation, best source first:
 * 1. Pre-recorded audio shipped with the starter packs (instant, offline, same voice everywhere).
 * 2. A device voice for the language (Web Speech API).
 * 3. The in-browser neural voice (Piper), downloaded automatically once.
 * 4. Otherwise: tell the user which voice to install (never read with a wrong-language voice).
 *
 * Web Speech API notes:
 *
 * Pitfalls handled here:
 * - Voices load asynchronously: getVoices() is often empty on the first call.
 * - Android reports some languages with legacy codes (Indonesian = "in-ID" / "in_ID", Hebrew = "iw").
 * - If no voice exists for the language, the browser silently falls back to its default
 *   (usually English) voice and mispronounces the word: we refuse instead and tell the user.
 */

const LOCALES: Record<string, string> = {
  id: "id-ID",
  fr: "fr-FR",
  en: "en-US",
  es: "es-ES",
  de: "de-DE",
  it: "it-IT",
  pt: "pt-PT",
  nl: "nl-NL",
  ja: "ja-JP",
  ko: "ko-KR",
  zh: "zh-CN",
  th: "th-TH",
  vi: "vi-VN",
  ms: "ms-MY"
};

/** Legacy / alternate ISO 639 codes still used by some platforms (Android, old Java locales). */
const ALIASES: Record<string, string> = { in: "id", iw: "he", ji: "yi", jw: "jv" };

/** "id" -> "id-ID"; already-qualified tags ("pt-BR") are kept. */
export function toLocale(lang?: string): string | undefined {
  if (!lang) return undefined;
  const l = lang.trim().replace("_", "-");
  if (l.includes("-")) return l;
  return LOCALES[l.toLowerCase()] ?? l;
}

/** Normalized base language of a tag: "in_ID" -> "id", "fr-FR" -> "fr". */
export function baseLang(tag: string): string {
  const base = tag.trim().replace("_", "-").split("-")[0].toLowerCase();
  return ALIASES[base] ?? base;
}

function webSpeechAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

/** Whether the app can pronounce anything at all (audio playback or a speech engine). */
export function speechSupported(): boolean {
  return typeof window !== "undefined" && (typeof Audio !== "undefined" || webSpeechAvailable());
}

let voicesPromise: Promise<SpeechSynthesisVoice[]> | null = null;

/** Resolves once the platform has published its voices (or after a short timeout). */
export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!webSpeechAvailable()) return Promise.resolve([]);
  const now = window.speechSynthesis.getVoices();
  if (now.length) return Promise.resolve(now);
  voicesPromise ??= new Promise((resolve) => {
    const done = () => resolve(window.speechSynthesis.getVoices());
    window.speechSynthesis.addEventListener("voiceschanged", done, { once: true });
    window.setTimeout(done, 1500);
  });
  return voicesPromise;
}

/** Best voice for a language: exact locale first ("id-ID"), then same base language ("id", "in-ID"). */
export function findVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | undefined {
  const locale = (toLocale(lang) ?? lang).toLowerCase();
  const base = baseLang(locale);
  const norm = (v: SpeechSynthesisVoice) => v.lang.replace("_", "-").toLowerCase();
  const sameBase = voices.filter((v) => baseLang(v.lang) === base);
  return (
    sameBase.find((v) => norm(v) === locale && v.localService) ??
    sameBase.find((v) => norm(v) === locale) ??
    sameBase.find((v) => v.localService) ??
    sameBase[0]
  );
}

export function languageName(lang: string): string {
  try {
    return new Intl.DisplayNames([intlLocale()], { type: "language" }).of(baseLang(lang)) ?? lang;
  } catch {
    return lang;
  }
}

const warned = new Set<string>();
function warnOnce(base: string, key: string, lang: string) {
  if (warned.has(`${key}:${base}`)) return;
  warned.add(`${key}:${base}`);
  toast(t(key, { language: languageName(lang) }), "danger", 7000);
}

let player: HTMLAudioElement | null = null;
let playerUrl: string | null = null;
let ctx: AudioContext | null = null;
let source: AudioBufferSourceNode | null = null;

/**
 * Web Audio context, created / resumed synchronously inside the click that triggered speak(): the
 * browser then allows playback later on, even after a long download (an <audio> element started
 * seconds after the click would be blocked by autoplay rules).
 */
function unlockAudio(): void {
  if (typeof window === "undefined") return;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  ctx ??= new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
}

/** Lets the UI (and tests) know which source pronounced the text. */
function announce(kind: "recorded" | "device" | "neural", text: string) {
  window.dispatchEvent(new CustomEvent("lf-speak", { detail: { kind, text } }));
}

function stopAll() {
  if (source) {
    try {
      source.stop();
    } catch {
      // already stopped
    }
    source = null;
  }
  if (player) {
    player.pause();
    player = null;
  }
  if (playerUrl) {
    URL.revokeObjectURL(playerUrl);
    playerUrl = null;
  }
  if (webSpeechAvailable()) window.speechSynthesis.cancel();
}

async function playUrl(url: string, ownsUrl = false): Promise<boolean> {
  if (ctx) {
    try {
      const data = await (await fetch(url)).arrayBuffer();
      if (ownsUrl) URL.revokeObjectURL(url);
      const buffer = await ctx.decodeAudioData(data);
      stopAll();
      source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start();
      return true;
    } catch (e) {
      console.error("Web Audio playback failed, using <audio>:", e);
      if (ownsUrl) return false; // object URL already revoked
    }
  }
  stopAll();
  const audio = new Audio(url);
  player = audio;
  if (ownsUrl) playerUrl = url;
  try {
    await audio.play();
    return true;
  } catch {
    return false;
  }
}

/**
 * Speaks `text` in `lang` using the best available source (see top of file).
 * Returns false when nothing could pronounce it (the user is told why, once per language).
 */
export async function speak(text: string, lang?: string, rate = 0.9): Promise<boolean> {
  if (!speechSupported() || !text.trim()) return false;
  unlockAudio(); // must run before the first await, while still inside the user's click
  const base = lang ? baseLang(lang) : "";

  // 1. Recorded audio
  if (base) {
    const url = await recordedUrl(text, base);
    if (url && (await playUrl(url))) {
      announce("recorded", text);
      return true;
    }
  }

  // 2. Device voice
  const voices = await loadVoices();
  const voice = lang ? findVoice(voices, lang) : undefined;
  if (webSpeechAvailable() && (voice || !lang)) {
    stopAll();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = rate;
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    }
    window.speechSynthesis.speak(u);
    announce("device", text);
    return true;
  }

  // 3. Neural voice in the browser
  if (base && hasNeuralVoice(base)) {
    try {
      if (!(await isVoiceCached(base))) {
        if (!warned.has(`dl:${base}`)) {
          warned.add(`dl:${base}`);
          toast(t("services.voiceDownloading", { language: languageName(lang!) }), "info", 6000);
        }
      }
      const wav = await synthesizeWav(text, base);
      const ok = await playUrl(URL.createObjectURL(wav), true);
      if (ok) announce("neural", text);
      return ok;
    } catch (e) {
      console.error("Neural voice failed:", e);
      warnOnce(base, "services.voiceError", lang!);
      return false;
    }
  }

  // 4. Platform exposes no voice list at all: let it pick from the language tag
  if (webSpeechAvailable() && !voices.length && lang) {
    stopAll();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = rate;
    u.lang = toLocale(lang) ?? lang;
    window.speechSynthesis.speak(u);
    return true;
  }

  if (base) warnOnce(base, "services.noVoice", lang!);
  return false;
}
