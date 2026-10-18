import { t } from "../i18n";
import { db, type ExamQuestion, type SentenceExercise, type VocabDeck, type VocabItem } from "../db";
import type { Table } from "dexie";
import { buildVocabQuestion } from "./vocabQuiz";
import { shuffle } from "../utils/shuffle";
import { checkAnswer } from "../utils/answer";
import { makeCloze } from "../utils/cloze";

export type PracticeSource = "vocab" | "exam" | "order" | "typed" | "cloze" | "dictation";
export const ALL_SOURCES: PracticeSource[] = ["vocab", "exam", "order", "typed", "cloze", "dictation"];
const DEFAULT_SOURCES: PracticeSource[] = ["vocab", "exam", "order"];

export type VocabDirection = "forward" | "reverse" | "both";

export type PracticeConfig = {
  tags: string[];
  count: number;
  sources: PracticeSource[];
  /** Sens des questions vocab (QCM et réponse tapée). */
  vocabDirection?: VocabDirection;
};

type Option = { id: string; text: string; correct: boolean };

export type TypedKind = "vocab_typed" | "cloze" | "dictation";

export type PracticeQuestion =
  | {
      kind: "vocab_mcq";
      id: string;
      prompt: string;
      options: Option[];
      answer?: string;
    }
  | {
      kind: "exam_mcq";
      id: string;
      prompt: string;
      options: Option[];
      explanation?: string;
      answer?: string;
    }
  | {
      kind: "sentence_order";
      id: string;
      text: string;
      translation?: string;
      tokens: string[];
      answer?: string[];
    }
  | {
      kind: TypedKind;
      id: string;
      prompt: string;
      expected: string;
      /** Langue (code deck, ex: "id") du texte à écrire / prononcer */
      lang?: string;
      /** Texte prononcé (dictée) */
      speak?: string;
      hint?: string;
      answer?: string;
    };

/** All rows when no tag is selected, else rows having at least one of the tags (via the *tags index). */
async function byTags<T>(table: Table<T, string>, tags: string[]): Promise<T[]> {
  if (!tags.length) return table.toArray();
  return table.where("tags").anyOf(tags).distinct().toArray();
}

function pickReverse(direction: VocabDirection): boolean {
  if (direction === "both") return Math.random() < 0.5;
  return direction === "reverse";
}

/** Swap term/definition so the same builders work in both directions. */
function flip(it: VocabItem): VocabItem {
  return { ...it, term: it.definition, definition: it.term };
}

export async function buildPractice(config: PracticeConfig): Promise<PracticeQuestion[]> {
  const count = Math.max(1, Math.min(200, config.count || 20));
  const tags = config.tags ?? [];
  const sources = config.sources.length ? config.sources : DEFAULT_SOURCES;
  const direction = config.vocabDirection ?? "forward";

  const pool: PracticeQuestion[] = [];

  const needsVocab = sources.some((s) => s === "vocab" || s === "typed" || s === "dictation");
  const vocabItems = needsVocab ? await byTags<VocabItem>(db.vocabItems, tags) : [];
  const decks = new Map<string, VocabDeck>(
    needsVocab ? (await db.vocabDecks.toArray()).map((d) => [d.id, d]) : []
  );

  if (sources.includes("vocab")) {
    // Distractors come from the same deck (same language pair) when it has enough items.
    const allItems = await db.vocabItems.toArray();
    const byDeck = new Map<string, VocabItem[]>();
    for (const it of allItems) {
      const list = byDeck.get(it.deckId);
      if (list) list.push(it);
      else byDeck.set(it.deckId, [it]);
    }

    for (const it of shuffle(vocabItems)) {
      const sameDeck = byDeck.get(it.deckId) ?? [];
      const candidates = sameDeck.length >= 4 ? sameDeck : allItems;
      const q = pickReverse(direction)
        ? buildVocabQuestion(candidates.map(flip), flip(it), 4)
        : buildVocabQuestion(candidates, it, 4);
      if (q.options.length < 2) continue;
      pool.push({ kind: "vocab_mcq", id: it.id, prompt: q.prompt, options: q.options });
    }
  }

  if (sources.includes("typed")) {
    for (const it of shuffle(vocabItems)) {
      const deck = decks.get(it.deckId);
      const reverse = pickReverse(direction);
      pool.push({
        kind: "vocab_typed",
        id: it.id,
        prompt: t("services.typedPrompt", { term: reverse ? it.definition : it.term }),
        expected: reverse ? it.term : it.definition,
        lang: reverse ? deck?.from : deck?.to
      });
    }
  }

  if (sources.includes("dictation")) {
    for (const it of shuffle(vocabItems)) {
      pool.push({
        kind: "dictation",
        id: it.id,
        prompt: t("services.dictationPrompt"),
        expected: it.term,
        speak: it.term,
        lang: decks.get(it.deckId)?.from,
        hint: it.definition
      });
    }
  }

  if (sources.includes("exam")) {
    const qs = await byTags<ExamQuestion>(db.examQuestions, tags);
    for (const q of shuffle(qs)) {
      pool.push({
        kind: "exam_mcq",
        id: q.id,
        prompt: q.prompt,
        // On mélange aussi les choix pour éviter l'effet "toujours le 2ème".
        options: shuffle(q.choices.map(c => ({ id: c.id, text: c.text, correct: c.correct }))),
        explanation: q.explanation
      });
    }
  }

  const needsSentences = sources.includes("order") || sources.includes("cloze");
  const sentences = needsSentences ? await byTags<SentenceExercise>(db.sentenceExercises, tags) : [];

  if (sources.includes("order")) {
    for (const s of shuffle(sentences)) {
      pool.push({ kind: "sentence_order", id: s.id, text: s.text, translation: s.translation, tokens: s.tokens, answer: [] });
    }
  }

  if (sources.includes("cloze")) {
    for (const s of shuffle(sentences)) {
      const c = makeCloze(s.tokens);
      if (!c) continue;
      pool.push({ kind: "cloze", id: s.id, prompt: c.display, expected: c.answer, hint: s.translation });
    }
  }

  return shuffle(pool).slice(0, Math.min(count, pool.length));
}

export function isPracticeCorrect(q: PracticeQuestion): boolean {
  if (q.kind === "vocab_mcq" || q.kind === "exam_mcq") {
    return q.options.find(o => o.id === q.answer)?.correct === true;
  }
  if (q.kind === "sentence_order") {
    const user = q.answer ?? [];
    return user.length === q.tokens.length && user.every((t, i) => t === q.tokens[i]);
  }
  return checkAnswer(q.answer ?? "", q.expected).correct;
}

const BREAKDOWN_KEY: Record<PracticeQuestion["kind"], string> = {
  vocab_mcq: "vocab",
  exam_mcq: "exam",
  sentence_order: "order",
  vocab_typed: "typed",
  cloze: "cloze",
  dictation: "dictation"
};

export function gradePractice(questions: PracticeQuestion[]): { correct: number; total: number; score: number; breakdown: Record<string, number> } {
  let correct = 0;
  const breakdown: Record<string, number> = { vocab: 0, exam: 0, order: 0 };

  for (const q of questions) {
    if (isPracticeCorrect(q)) correct += 1;
    const key = BREAKDOWN_KEY[q.kind];
    breakdown[key] = (breakdown[key] ?? 0) + 1;
  }

  const total = questions.length;
  const score = total ? correct / total : 0;
  return { correct, total, score, breakdown };
}
