import { db } from "../db";
import { hasAnyTag } from "./tags";
import { buildVocabQuestion } from "./vocabQuiz";
import { shuffle } from "../utils/shuffle";

export type PracticeSource = "vocab" | "exam" | "order";

export type PracticeConfig = {
  tags: string[];
  count: number;
  sources: PracticeSource[];
};

export type PracticeQuestion =
  | {
      kind: "vocab_mcq";
      id: string;
      prompt: string;
      options: { id: string; text: string; correct: boolean }[];
      answer?: string;
    }
  | {
      kind: "exam_mcq";
      id: string;
      prompt: string;
      options: { id: string; text: string; correct: boolean }[];
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
    };

export async function buildPractice(config: PracticeConfig): Promise<PracticeQuestion[]> {
  const count = Math.max(1, Math.min(200, config.count || 20));
  const tags = config.tags ?? [];
  const sources = config.sources.length ? config.sources : ["vocab", "exam", "order"];

  const pool: PracticeQuestion[] = [];

  if (sources.includes("vocab")) {
    const vocabItems = (await db.vocabItems.toArray()).filter(it => hasAnyTag(it.tags, tags));
    for (const it of shuffle(vocabItems)) {
      const q = buildVocabQuestion(vocabItems, it, Math.min(4, Math.max(2, vocabItems.length)));
      pool.push({ kind: "vocab_mcq", id: it.id, prompt: q.prompt, options: q.options });
    }
  }

  if (sources.includes("exam")) {
    const qs = (await db.examQuestions.toArray()).filter(q => hasAnyTag(q.tags, tags));
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

  if (sources.includes("order")) {
    const ss = (await db.sentenceExercises.toArray()).filter(s => hasAnyTag(s.tags, tags));
    for (const s of shuffle(ss)) {
      pool.push({ kind: "sentence_order", id: s.id, text: s.text, translation: s.translation, tokens: s.tokens, answer: [] });
    }
  }

  return shuffle(pool).slice(0, Math.min(count, pool.length));
}

export function gradePractice(questions: PracticeQuestion[]): { correct: number; total: number; score: number; breakdown: Record<string, number> } {
  let correct = 0;
  let total = 0;
  const breakdown: Record<string, number> = { vocab: 0, exam: 0, order: 0 };

  for (const q of questions) {
    if (q.kind === "vocab_mcq" || q.kind === "exam_mcq") {
      total += 1;
      const picked = q.answer;
      const isCorrect = q.options.find(o => o.id === picked)?.correct === true;
      if (isCorrect) correct += 1;
      breakdown[q.kind === "vocab_mcq" ? "vocab" : "exam"] += 1;
    } else if (q.kind === "sentence_order") {
      total += 1;
      const user = q.answer ?? [];
      const ok = user.length === q.tokens.length && user.every((t, i) => t === q.tokens[i]);
      if (ok) correct += 1;
      breakdown.order += 1;
    }
  }

  const score = total ? correct / total : 0;
  return { correct, total, score, breakdown };
}
