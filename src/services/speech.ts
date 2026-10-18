import { intlLocale, t } from "../i18n";
import { toast } from "./dialog";

/**
 * Text-to-speech via the Web Speech API (browsers + recent Android WebViews).
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

export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

let voicesPromise: Promise<SpeechSynthesisVoice[]> | null = null;

/** Resolves once the platform has published its voices (or after a short timeout). */
export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!speechSupported()) return Promise.resolve([]);
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

function languageName(lang: string): string {
  try {
    return new Intl.DisplayNames([intlLocale()], { type: "language" }).of(baseLang(lang)) ?? lang;
  } catch {
    return lang;
  }
}

const warned = new Set<string>();

/**
 * Speaks `text` in `lang`. Returns false (and warns once per language) when the device
 * has no voice for that language, instead of reading it with a wrong-language voice.
 */
export async function speak(text: string, lang?: string, rate = 0.9): Promise<boolean> {
  if (!speechSupported() || !text.trim()) return false;
  const synth = window.speechSynthesis;
  const voices = await loadVoices();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = rate;

  if (lang) {
    const voice = findVoice(voices, lang);
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    } else if (voices.length) {
      // Voices are known but none speaks this language: don't fall back to English.
      const base = baseLang(lang);
      if (!warned.has(base)) {
        warned.add(base);
        toast(t("services.noVoice", { language: languageName(lang) }), "danger", 7000);
      }
      return false;
    } else {
      // Platform exposes no voice list: let it pick from the language tag.
      u.lang = toLocale(lang) ?? lang;
    }
  }

  synth.cancel();
  synth.speak(u);
  return true;
}
