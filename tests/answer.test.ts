import { describe, expect, it } from "vitest";
import { acceptedAnswers, checkAnswer, levenshtein, normalizeAnswer } from "../src/utils/answer";

describe("answer checking", () => {
  it("normalizes case, accents, punctuation and spaces", () => {
    expect(normalizeAnswer("  L'Été  ! ")).toBe("l ete");
  });

  it("accepts listed alternatives and optional parts", () => {
    expect(acceptedAnswers("manger / bouffer")).toEqual(["manger", "bouffer"]);
    expect(acceptedAnswers("(se) laver")).toEqual(["se laver", "laver"]);
  });

  it("computes edit distance", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("", "abc")).toBe(3);
  });

  it("allows one typo on longer words only", () => {
    expect(checkAnswer("Mangér", "manger")).toEqual({ correct: true, typo: false });
    expect(checkAnswer("mangr", "manger")).toEqual({ correct: true, typo: true });
    expect(checkAnswer("eaux", "eau")).toEqual({ correct: false, typo: false });
    expect(checkAnswer("", "boire").correct).toBe(false);
    expect(checkAnswer("bouffer", "manger / bouffer").correct).toBe(true);
  });
});
