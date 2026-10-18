// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { recordedUrl, synthesizeWav } = vi.hoisted(() => ({
  recordedUrl: vi.fn<(text: string, base: string) => Promise<string | null>>(),
  synthesizeWav: vi.fn<(text: string, base: string) => Promise<Blob>>()
}));
vi.mock("../src/services/recordedAudio", () => ({ recordedUrl }));
vi.mock("../src/services/piper", () => ({
  hasNeuralVoice: (base: string) => base === "id",
  isVoiceCached: async () => true,
  synthesizeWav
}));

import { baseLang, findVoice, speak, toLocale } from "../src/services/speech";
import { dialogState } from "../src/services/dialog";

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
    expect(findVoice([voice("es-MX"), voice("es-ES")], "es")?.lang).toBe("es-ES");
    expect(findVoice([voice("es-MX")], "es")?.lang).toBe("es-MX");
  });

  it("never returns a voice of another language", () => {
    expect(findVoice([voice("en-US"), voice("en-GB")], "id")).toBeUndefined();
  });
});

describe("speak: source order", () => {
  let spoken: SpeechSynthesisUtterance[];
  let played: string[];

  function setup(deviceVoices: SpeechSynthesisVoice[]) {
    spoken = [];
    played = [];
    vi.stubGlobal("speechSynthesis", {
      getVoices: () => deviceVoices,
      speak: (u: SpeechSynthesisUtterance) => spoken.push(u),
      cancel: () => {},
      addEventListener: () => {}
    });
    vi.stubGlobal("SpeechSynthesisUtterance", class { text: string; lang = ""; voice: unknown = null; rate = 1; constructor(t: string) { this.text = t; } });
    vi.stubGlobal("Audio", class { src: string; constructor(src: string) { this.src = src; } play() { played.push(this.src); return Promise.resolve(); } pause() {} });
    URL.createObjectURL = () => "blob:wav";
    URL.revokeObjectURL = () => {};
  }

  beforeEach(() => {
    recordedUrl.mockReset();
    synthesizeWav.mockReset();
    dialogState.toasts.splice(0);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("plays the recording first, even when a device voice exists", async () => {
    setup([voice("id-ID")]);
    recordedUrl.mockResolvedValue("/audio/id/abc.mp3");
    expect(await speak("makan", "id")).toBe(true);
    expect(played).toEqual(["/audio/id/abc.mp3"]);
    expect(spoken).toHaveLength(0);
  });

  it("uses the device voice when there is no recording", async () => {
    setup([voice("en-US"), voice("in_ID")]);
    recordedUrl.mockResolvedValue(null);
    expect(await speak("pisang goreng", "id")).toBe(true);
    expect(spoken[0].lang).toBe("in_ID");
    expect(synthesizeWav).not.toHaveBeenCalled();
  });

  it("falls back to the neural voice instead of a wrong-language device voice", async () => {
    setup([voice("en-US")]);
    recordedUrl.mockResolvedValue(null);
    synthesizeWav.mockResolvedValue(new Blob(["x"]));
    expect(await speak("kucing", "id")).toBe(true);
    expect(synthesizeWav).toHaveBeenCalledWith("kucing", "id");
    expect(played).toEqual(["blob:wav"]);
    expect(spoken).toHaveLength(0);
  });

  it("warns once when nothing can pronounce the language", async () => {
    setup([voice("en-US")]);
    recordedUrl.mockResolvedValue(null);
    expect(await speak("สวัสดี", "th")).toBe(false);
    expect(await speak("ขอบคุณ", "th")).toBe(false);
    expect(spoken).toHaveLength(0);
    expect(dialogState.toasts.filter((t) => t.kind === "danger")).toHaveLength(1);
  });
});
