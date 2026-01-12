import { db } from "../db";

/**
 * Returns a sorted list of unique tags used across:
 * - vocab items
 * - exam questions
 * - sentence exercises
 */
export async function getAllTags(): Promise<string[]> {
  const set = new Set<string>();

  const vocab = await db.vocabItems.toArray();
  for (const it of vocab) (it.tags ?? []).forEach(t => set.add(t));

  const qcm = await db.examQuestions.toArray();
  for (const q of qcm) (q.tags ?? []).forEach(t => set.add(t));

  const sentences = await db.sentenceExercises.toArray();
  for (const s of sentences) (s.tags ?? []).forEach(t => set.add(t));

  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function hasAnyTag(itemTags: string[] | undefined, selected: string[]): boolean {
  if (!selected.length) return true;
  if (!itemTags?.length) return false;
  const s = new Set(selected);
  return itemTags.some(t => s.has(t));
}
