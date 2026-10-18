// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { baseLang, findVoice, toLocale } from "../src/services/speech";

const voice = (lang: string, name = lang, localService = true) =>
  ({ lang, name, localService, default: false, voiceURI: name }) as SpeechSynthesisVoice;

describe("speech voice matching", () => {
  it("normalizes language codes, including Android legacy ones", () => {
    expect(baseLang("in_ID")).toBe("id");
    expect(baseLang("in-ID")).toBe("id");
    expect(baseLang("fr-FR")).toBe("fr");
    expect(toLocale("id")).toBe("id-ID");
    expect(toLocale("pt_BR")).toBe("pt-BR");
  });

  it("finds the Indonesian voice reported as in_ID on Android", () => {
    const voices = [voice("en-US"), voice("in_ID", "Bahasa Indonesia"), voice("fr-FR")];
    expect(findVoice(voices, "id")?.name).toBe("Bahasa Indonesia");
  });

  it("prefers the exact locale, then any voice of the same language", () => {
    const voices = [voice("es-MX"), voice("es-ES")];
    expect(findVoice(voices, "es")?.lang).toBe("es-ES");
    expect(findVoice([voice("es-MX")], "es")?.lang).toBe("es-MX");
  });

  it("never returns a voice of another language", () => {
    expect(findVoice([voice("en-US"), voice("en-GB")], "id")).toBeUndefined();
  });
});

describe("speak", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("refuses to read Indonesian with an English voice and warns once", async () => {
    const spoken: SpeechSynthesisUtterance[] = [];
    vi.stubGlobal("speechSynthesis", {
      getVoices: () => [voice("en-US")],
      speak: (u: SpeechSynthesisUtterance) => spoken.push(u),
      cancel: () => {},
      addEventListener: () => {}
    });
    vi.stubGlobal("SpeechSynthesisUtterance", class { text: string; lang = ""; voice: unknown = null; rate = 1; constructor(t: string) { this.text = t; } });
    const { speak } = await import("../src/services/speech");
    const { dialogState } = await import("../src/services/dialog");

    expect(await speak("makan", "id")).toBe(false);
    expect(await speak("minum", "id")).toBe(false);
    expect(spoken).toHaveLength(0);
    expect(dialogState.toasts.filter((t) => t.kind === "danger")).toHaveLength(1);

    expect(await speak("hello", "en")).toBe(true);
    expect(spoken[0].lang).toBe("en-US");
  });
});
