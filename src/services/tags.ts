import { db } from "../db";

/**
 * Returns a sorted list of unique tags used across:
 * - vocab items
 * - exam questions
 * - sentence exercises
 */
export async function getAllTags(): Promise<string[]> {
  const keys = await Promise.all([
    db.vocabItems.orderBy("tags").uniqueKeys(),
    db.examQuestions.orderBy("tags").uniqueKeys(),
    db.sentenceExercises.orderBy("tags").uniqueKeys()
  ]);
  const set = new Set(keys.flat().map(String));
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function hasAnyTag(itemTags: string[] | undefined, selected: string[]): boolean {
  if (!selected.length) return true;
  if (!itemTags?.length) return false;
  const s = new Set(selected);
  return itemTags.some(t => s.has(t));
}

export function parseTags(input: string): string[] {
  return input
    .split(",")
    .map(t => t.trim())
    .filter(Boolean);
}
