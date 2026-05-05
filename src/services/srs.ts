/**
 * Spaced Repetition System (SM-2 variant)
 *
 * Each item has:
 *  - easeFactor: how easy the item is (starts at 2.5, min 1.3)
 *  - interval: days until next review
 *  - repetitions: consecutive correct answers
 *  - nextReview: timestamp of next review
 *
 * Quality grades: 0-5
 *  0 = total blackout
 *  1 = wrong, but recognized answer
 *  2 = wrong, but easy recall after seeing answer
 *  3 = correct with serious difficulty
 *  4 = correct with some hesitation
 *  5 = perfect, instant recall
 *
 * Simplified for the app:
 *  "Je ne sais pas"  → grade 1
 *  "Je sais" (slow)   → grade 3
 *  "Je sais" (fast)   → grade 5
 */

import { db } from "../db";
import type { SrsCard } from "../db";

export interface SrsUpdate {
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReview: number;
}

/**
 * Calculate next review parameters using SM-2 algorithm.
 * @param card Current card state (or defaults for new card)
 * @param grade Quality of response (0-5)
 */
export function sm2(card: Pick<SrsCard, "easeFactor" | "interval" | "repetitions">, grade: number): SrsUpdate {
  const q = Math.max(0, Math.min(5, Math.round(grade)));

  let { easeFactor, interval, repetitions } = card;

  if (q < 3) {
    // Failed: reset repetitions, short interval
    repetitions = 0;
    interval = 1;
  } else {
    // Success
    repetitions += 1;
    if (repetitions === 1) {
      interval = 1;
    } else if (repetitions === 2) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
  }

  // Update ease factor
  easeFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  easeFactor = Math.max(1.3, easeFactor);

  const nextReview = Date.now() + interval * 24 * 60 * 60 * 1000;

  return { easeFactor, interval, repetitions, nextReview };
}

/** Default values for a new SRS card */
export function defaultSrsCard(itemId: string, itemType: "vocab" | "exam" | "sentence"): SrsCard {
  return {
    id: `srs:${itemId}`,
    itemId,
    itemType,
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReview: 0, // due immediately
    lastReview: 0
  };
}

/**
 * Record a review result for an item.
 * Creates the SRS card if it doesn't exist yet.
 */
export async function recordReview(itemId: string, itemType: "vocab" | "exam" | "sentence", grade: number): Promise<void> {
  const srsId = `srs:${itemId}`;
  let card = await db.srsCards.get(srsId);

  if (!card) {
    card = defaultSrsCard(itemId, itemType);
  }

  const update = sm2(card, grade);

  await db.srsCards.put({
    ...card,
    ...update,
    lastReview: Date.now()
  });
}

/**
 * Get items due for review (nextReview <= now).
 * Returns sorted by most overdue first.
 */
export async function getDueCards(itemType?: "vocab" | "exam" | "sentence", limit = 50): Promise<SrsCard[]> {
  const now = Date.now();

  let query = db.srsCards.where("nextReview").belowOrEqual(now);

  const all = await query.toArray();

  const filtered = itemType ? all.filter(c => c.itemType === itemType) : all;

  // Sort by most overdue first
  filtered.sort((a, b) => a.nextReview - b.nextReview);

  return filtered.slice(0, limit);
}

/**
 * Get SRS stats summary
 */
export async function getSrsStats(): Promise<{
  total: number;
  due: number;
  learned: number;
  avgEase: number;
}> {
  const now = Date.now();
  const all = await db.srsCards.toArray();

  const due = all.filter(c => c.nextReview <= now).length;
  const learned = all.filter(c => c.repetitions >= 3).length;
  const avgEase = all.length
    ? all.reduce((sum, c) => sum + c.easeFactor, 0) / all.length
    : 2.5;

  return { total: all.length, due, learned, avgEase };
}
