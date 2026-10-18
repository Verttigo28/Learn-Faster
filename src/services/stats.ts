import type { Attempt, ReviewState, VocabItem } from "../db";
import { DAY } from "./srs";

/** Local calendar day key "YYYY-MM-DD". */
export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Answers per activity: one per question answered (flashcards / quiz / exam / practice). */
function answersOf(a: Attempt): number {
  return a.meta?.total ?? 1;
}

export type DayActivity = { key: string; date: number; answers: number; correct: number };

/** Last `days` days, oldest first, including empty days. */
export function activityByDay(attempts: Attempt[], days: number, now = Date.now()): DayActivity[] {
  const map = new Map<string, { answers: number; correct: number }>();
  for (const a of attempts) {
    const k = dayKey(a.finishedAt);
    const cur = map.get(k) ?? { answers: 0, correct: 0 };
    cur.answers += answersOf(a);
    cur.correct += a.meta?.correct ?? Math.round(a.score * answersOf(a));
    map.set(k, cur);
  }
  const out: DayActivity[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = now - i * DAY;
    const key = dayKey(date);
    out.push({ key, date, ...(map.get(key) ?? { answers: 0, correct: 0 }) });
  }
  return out;
}

/**
 * Consecutive days with activity, ending today — or yesterday if nothing was done yet today
 * (the streak is not lost before the day is over).
 */
export function streak(attempts: Attempt[], now = Date.now()): number {
  const active = new Set(attempts.map((a) => dayKey(a.finishedAt)));
  let day = now;
  if (!active.has(dayKey(day))) day -= DAY;
  let n = 0;
  while (active.has(dayKey(day))) {
    n++;
    day -= DAY;
  }
  return n;
}

/** Longest run of consecutive active days ever. */
export function bestStreak(attempts: Attempt[]): number {
  const days = [...new Set(attempts.map((a) => dayKey(a.finishedAt)))].sort();
  let best = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const k of days) {
    const [y, m, d] = k.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const expected = prev ? new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 1) : null;
    run = expected && dayKey(expected.getTime()) === k ? run + 1 : 1;
    best = Math.max(best, run);
    prev = date;
  }
  return best;
}

export type HeatCell = { key: string; date: number; answers: number; correct: number; future: boolean };

/**
 * Calendar grid of the last `weeks` weeks: columns = weeks (oldest first), rows = Monday..Sunday.
 * Days after `now` are flagged `future` (the current week is partially filled).
 */
export function heatmapWeeks(attempts: Attempt[], weeks: number, now = Date.now()): HeatCell[][] {
  const map = new Map<string, { answers: number; correct: number }>();
  for (const a of attempts) {
    const k = dayKey(a.finishedAt);
    const cur = map.get(k) ?? { answers: 0, correct: 0 };
    cur.answers += answersOf(a);
    cur.correct += a.meta?.correct ?? Math.round(a.score * answersOf(a));
    map.set(k, cur);
  }
  const today = new Date(now);
  const todayKey = dayKey(now);
  const mondayOffset = (today.getDay() + 6) % 7; // 0 = Monday
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - mondayOffset - (weeks - 1) * 7);
  const out: HeatCell[][] = [];
  let future = false;
  for (let w = 0; w < weeks; w++) {
    const col: HeatCell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d, 12);
      const key = dayKey(date.getTime());
      col.push({ key, date: date.getTime(), future, ...(map.get(key) ?? { answers: 0, correct: 0 }) });
      if (key === todayKey) future = true;
    }
    out.push(col);
  }
  return out;
}

/** Intensity step 0..4 (0 = no activity), linear in `answers / max`. */
export function heatLevel(answers: number, max: number): number {
  if (answers <= 0 || max <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((answers / max) * 4)));
}

export function answersToday(attempts: Attempt[], now = Date.now()): number {
  const today = dayKey(now);
  return attempts.filter((a) => dayKey(a.finishedAt) === today).reduce((acc, a) => acc + answersOf(a), 0);
}

/** Interval (days) from which a card counts as "maîtrisée". */
export const MASTERED_DAYS = 21;

export type DeckProgress = { deckId: string; total: number; fresh: number; learning: number; mastered: number };

export function deckProgress(items: VocabItem[], reviews: ReviewState[]): DeckProgress[] {
  const forward = new Map(reviews.filter((r) => r.direction === "forward").map((r) => [r.itemId, r]));
  const byDeck = new Map<string, DeckProgress>();
  for (const it of items) {
    const p = byDeck.get(it.deckId) ?? { deckId: it.deckId, total: 0, fresh: 0, learning: 0, mastered: 0 };
    p.total++;
    const r = forward.get(it.id);
    if (!r) p.fresh++;
    else if (r.interval >= MASTERED_DAYS) p.mastered++;
    else p.learning++;
    byDeck.set(it.deckId, p);
  }
  return [...byDeck.values()];
}

export type HardWord = { item: VocabItem; lapses: number; ease: number };

/** Cards most often forgotten (lapses), then lowest ease. */
export function hardestWords(items: VocabItem[], reviews: ReviewState[], limit = 10): HardWord[] {
  const byId = new Map(items.map((it) => [it.id, it]));
  const merged = new Map<string, HardWord>();
  for (const r of reviews) {
    const item = byId.get(r.itemId);
    if (!item || (r.lapses === 0 && r.ease >= 2.5)) continue;
    const cur = merged.get(r.itemId);
    if (!cur) merged.set(r.itemId, { item, lapses: r.lapses, ease: r.ease });
    else merged.set(r.itemId, { item, lapses: cur.lapses + r.lapses, ease: Math.min(cur.ease, r.ease) });
  }
  return [...merged.values()]
    .sort((a, b) => b.lapses - a.lapses || a.ease - b.ease)
    .slice(0, limit);
}
