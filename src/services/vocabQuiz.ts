import type { VocabItem } from "../db";
import { shuffle } from "../utils/shuffle";

/**
 * Builds a multiple-choice question from a vocab item.
 * 1 correct definition + (choiceCount-1) random distractors from same deck.
 */
export function buildVocabQuestion(
  items: VocabItem[],
  item: VocabItem,
  choiceCount = 4
): { prompt: string; options: { id: string; text: string; correct: boolean }[] } {
  const distractors = items
    .filter((x) => x.id !== item.id)
    ;
  const pickedDistractors = shuffle(distractors).slice(0, Math.max(0, choiceCount - 1));

  const options = [
    { id: "correct", text: item.definition, correct: true },
    ...pickedDistractors.map((d, i) => ({ id: `d${i}`, text: d.definition, correct: false }))
  ];

  const shuffledOptions = shuffle(options);

  return {
    prompt: `Traduction de: "${item.term}"`,
    options: shuffledOptions
  };
}
