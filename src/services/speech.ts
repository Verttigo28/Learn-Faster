/** Synthèse vocale via la Web Speech API (navigateur + WebView Android récente). */

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

/** "id" -> "id-ID"; already-qualified tags ("pt-BR") are kept. */
export function toLocale(lang?: string): string | undefined {
  if (!lang) return undefined;
  const l = lang.trim();
  if (l.includes("-")) return l;
  return LOCALES[l.toLowerCase()] ?? l;
}

export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

export function speak(text: string, lang?: string, rate = 0.9): void {
  if (!speechSupported() || !text.trim()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const locale = toLocale(lang);
  if (locale) {
    u.lang = locale;
    const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith(locale.slice(0, 2).toLowerCase()));
    if (voice) u.voice = voice;
  }
  u.rate = rate;
  synth.speak(u);
}
