import { t } from "../i18n";
import type { VocabItem } from "../db";
import { shuffle } from "../utils/shuffle";

function norm(s: string): string {
  return s.trim().toLocaleLowerCase();
}

/**
 * Builds a multiple-choice question from a vocab item.
 * 1 correct definition + (choiceCount-1) random distractors.
 * Distractors never repeat the correct answer or each other (same text).
 */
export function buildVocabQuestion(
  items: VocabItem[],
  item: VocabItem,
  choiceCount = 4
): { prompt: string; options: { id: string; text: string; correct: boolean }[] } {
  const seen = new Set([norm(item.definition)]);
  const distractors: VocabItem[] = [];
  for (const d of shuffle(items)) {
    if (distractors.length >= choiceCount - 1) break;
    const key = norm(d.definition);
    if (seen.has(key)) continue;
    seen.add(key);
    distractors.push(d);
  }

  const options = [
    { id: "correct", text: item.definition, correct: true },
    ...distractors.map((d, i) => ({ id: `d${i}`, text: d.definition, correct: false }))
  ];

  return {
    prompt: t("services.vocabPrompt", { term: item.term }),
    options: shuffle(options)
  };
}
