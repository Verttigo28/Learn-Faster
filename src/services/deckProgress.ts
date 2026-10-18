import type { ReviewState } from "../db";
import { endOfDay } from "./srs";
import { MASTERED_DAYS } from "./stats";

export type WordStatus = "new" | "learning" | "mastered" | "due";

/** Status of one word from its forward review (undefined = never studied). Due wins over learning/mastered. */
export function wordStatus(review: ReviewState | undefined, now = Date.now()): WordStatus {
  if (!review) return "new";
  if (review.due <= endOfDay(now)) return "due";
  return review.interval >= MASTERED_DAYS ? "mastered" : "learning";
}

/**
 * Forward cards due before tonight, per deck, from a single read of the reviews table
 * (same rule as buildReviewQueue, without new cards).
 */
export function dueCountByDeck(reviews: ReviewState[], now = Date.now()): Map<string, number> {
  const limit = endOfDay(now);
  const out = new Map<string, number>();
  for (const r of reviews) {
    if (r.direction !== "forward" || r.due > limit) continue;
    out.set(r.deckId, (out.get(r.deckId) ?? 0) + 1);
  }
  return out;
}
