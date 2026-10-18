import { db } from "../db";
import { normalizeAnswer } from "../utils/answer";

export type SearchHit =
  | { kind: "vocab"; id: string; title: string; subtitle: string; link: string }
  | { kind: "qcm"; id: string; title: string; subtitle: string; link: string }
  | { kind: "sentence"; id: string; title: string; subtitle: string; link: string };

/** Accent/case-insensitive substring search over vocab, QCM questions and sentences (incl. tags). */
export async function searchAll(query: string, limit = 100): Promise<SearchHit[]> {
  const q = normalizeAnswer(query);
  if (q.length < 2) return [];
  const has = (...fields: (string | undefined)[]) => fields.some((f) => f && normalizeAnswer(f).includes(q));

  const [decks, items, exams, questions, sdecks, sentences] = await Promise.all([
    db.vocabDecks.toArray(),
    db.vocabItems.toArray(),
    db.exams.toArray(),
    db.examQuestions.toArray(),
    db.sentenceDecks.toArray(),
    db.sentenceExercises.toArray()
  ]);
  const deckTitle = new Map(decks.map((d) => [d.id, d.title]));
  const examTitle = new Map(exams.map((e) => [e.id, e.title]));
  const sdeckTitle = new Map(sdecks.map((d) => [d.id, d.title]));

  const hits: SearchHit[] = [];
  for (const it of items) {
    if (has(it.term, it.definition, ...(it.tags ?? []))) {
      hits.push({
        kind: "vocab", id: it.id, title: `${it.term} → ${it.definition}`,
        subtitle: deckTitle.get(it.deckId) ?? it.deckId, link: `/vocab/${encodeURIComponent(it.deckId)}/edit`
      });
    }
  }
  for (const qq of questions) {
    if (has(qq.prompt, qq.explanation, ...qq.choices.map((c) => c.text), ...(qq.tags ?? []))) {
      hits.push({
        kind: "qcm", id: qq.id, title: qq.prompt,
        subtitle: examTitle.get(qq.examId) ?? qq.examId, link: `/qcm/${encodeURIComponent(qq.examId)}/edit`
      });
    }
  }
  for (const s of sentences) {
    if (has(s.text, s.translation, ...(s.tags ?? []))) {
      hits.push({
        kind: "sentence", id: s.id, title: s.text,
        subtitle: [sdeckTitle.get(s.deckId), s.translation].filter(Boolean).join(" • "), link: "/sentences"
      });
    }
  }
  return hits.slice(0, limit);
}
