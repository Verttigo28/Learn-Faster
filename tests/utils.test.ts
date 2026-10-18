import { describe, expect, it } from "vitest";
import { shuffle } from "../src/utils/shuffle";
import { tokenizeSentence } from "../src/utils/sentence";
import { clamp01, formatDuration } from "../src/utils/time";
import { hasAnyTag } from "../src/services/tags";

describe("shuffle", () => {
  it("keeps the same elements and does not mutate the input", () => {
    const input = [1, 2, 3, 4, 5, 6];
    const out = shuffle(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...out].sort()).toEqual(input);
  });

  it("handles empty and single-element arrays", () => {
    expect(shuffle([])).toEqual([]);
    expect(shuffle([1])).toEqual([1]);
  });
});

describe("tokenizeSentence", () => {
  it("splits on any whitespace and drops empties", () => {
    expect(tokenizeSentence("  Saya   makan\tnasi ")).toEqual(["Saya", "makan", "nasi"]);
  });
});

describe("time utils", () => {
  it("clamps to [0, 1]", () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(0.4)).toBe(0.4);
    expect(clamp01(3)).toBe(1);
  });

  it("formats durations as m:ss", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(65)).toBe("1:05");
  });
});

describe("hasAnyTag", () => {
  it("matches everything when no tag is selected", () => {
    expect(hasAnyTag(undefined, [])).toBe(true);
  });
  it("requires at least one common tag", () => {
    expect(hasAnyTag(["a", "b"], ["b"])).toBe(true);
    expect(hasAnyTag(["a"], ["c"])).toBe(false);
    expect(hasAnyTag(undefined, ["c"])).toBe(false);
  });
});
