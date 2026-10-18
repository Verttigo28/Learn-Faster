import { db, type ReviewState, type VocabItem } from "../db";
import { shuffle } from "../utils/shuffle";
import { getSetting } from "./settings";

/** 0 = À revoir, 1 = Difficile, 2 = Bien, 3 = Facile */
export type Grade = 0 | 1 | 2 | 3;
export type Direction = "forward" | "reverse";

export const DAY = 24 * 3600 * 1000;
const RELEARN_DELAY = 10 * 60 * 1000;
const MIN_EASE = 1.3;

export function cardId(itemId: string, direction: Direction = "forward"): string {
  return direction === "forward" ? itemId : `${itemId}#rev`;
}

export function endOfDay(now: number): number {
  const d = new Date(now);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export function newReview(item: VocabItem, direction: Direction = "forward"): ReviewState {
  return {
    cardId: cardId(item.id, direction),
    itemId: item.id,
    deckId: item.deckId,
    direction,
    ease: 2.5,
    interval: 0,
    reps: 0,
    lapses: 0,
    due: 0,
    introducedAt: 0,
    lastReviewed: 0
  };
}

/**
 * SM-2 (variante Anki simplifiée). Interval en jours.
 * Pure: retourne un nouvel état sans toucher la base.
 */
export function schedule(state: ReviewState, grade: Grade, now = Date.now()): ReviewState {
  const s = { ...state, lastReviewed: now, introducedAt: state.introducedAt || now };

  if (grade === 0) {
    s.lapses += state.reps > 0 ? 1 : 0;
    s.reps = 0;
    s.interval = 0;
    s.ease = Math.max(MIN_EASE, state.ease - 0.2);
    s.due = now + RELEARN_DELAY;
    return s;
  }

  const prev = state.interval;
  let interval: number;
  if (grade === 1) {
    interval = prev === 0 ? 1 : Math.max(prev + 1, Math.round(prev * 1.2));
    s.ease = Math.max(MIN_EASE, state.ease - 0.15);
  } else if (grade === 2) {
    interval = prev === 0 ? 1 : Math.max(prev + 1, Math.round(prev * state.ease));
  } else {
    interval = prev === 0 ? 4 : Math.max(prev + 2, Math.round(prev * state.ease * 1.3));
    s.ease = state.ease + 0.15;
  }

  s.reps = state.reps + 1;
  s.interval = interval;
  s.due = now + interval * DAY;
  return s;
}

/** Human readable next interval for a button label ("10 min", "3 j", "2 mois"). */
export function formatInterval(state: ReviewState, now: number): string {
  const ms = state.due - now;
  if (ms < 3600 * 1000) return `${Math.max(1, Math.round(ms / 60000))} min`;
  const days = Math.round(ms / DAY);
  if (days < 31) return `${days} j`;
  if (days < 365) return `${Math.round(days / 30)} mois`;
  return `${(days / 365).toFixed(1)} an`;
}

export type QueueCard = { item: VocabItem; review: ReviewState; isNew: boolean };

/**
 * Cards to study today: every card due before tonight, plus up to `newPerDay` new cards
 * (minus new cards already started today).
 */
export async function buildReviewQueue(opts: { deckId?: string; direction?: Direction; now?: number } = {}): Promise<QueueCard[]> {
  const now = opts.now ?? Date.now();
  const direction = opts.direction ?? "forward";
  const items = opts.deckId
    ? await db.vocabItems.where("deckId").equals(opts.deckId).toArray()
    : await db.vocabItems.toArray();
  const reviews = await db.reviews.bulkGet(items.map((it) => cardId(it.id, direction)));

  const due: QueueCard[] = [];
  const fresh: QueueCard[] = [];
  items.forEach((item, i) => {
    const r = reviews[i];
    if (!r) fresh.push({ item, review: newReview(item, direction), isNew: true });
    else if (r.due <= endOfDay(now)) due.push({ item, review: r, isNew: false });
  });

  const newPerDay = await getSetting("newPerDay");
  const startOfDay = endOfDay(now) - DAY + 1;
  const startedToday = await db.reviews
    .where("introducedAt")
    .aboveOrEqual(startOfDay)
    .filter((r) => r.direction === direction)
    .count();
  const newBudget = Math.max(0, newPerDay - startedToday);

  due.sort((a, b) => a.review.due - b.review.due);
  return [...due, ...shuffle(fresh).slice(0, newBudget)];
}

export async function countDueToday(now = Date.now()): Promise<{ due: number; fresh: number }> {
  const q = await buildReviewQueue({ now });
  const fresh = q.filter((c) => c.isNew).length;
  return { due: q.length - fresh, fresh };
}

export async function saveReview(state: ReviewState): Promise<void> {
  await db.reviews.put(state);
}
