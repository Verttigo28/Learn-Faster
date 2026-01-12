import { db } from "../db";
import type {
  VocabDeckJson,
  QcmExamJson,
  SentenceDeckJson,
  RevisionsBundleJson
} from "../types/json";
import { tokenizeSentence } from "../utils/sentence";

/**
 * Import vocab deck JSON into IndexedDB.
 * Idempotent: same deck id overwrites its items.
 */
export async function importVocabDeck(data: VocabDeckJson): Promise<{ title: string; count: number }> {
  await db.vocabDecks.put({
    id: data.id,
    title: data.title,
    from: data.from,
    to: data.to,
    createdAt: Date.now()
  });

  const prefix = `${data.id}:`;
  await db.vocabItems.where("id").startsWith(prefix).delete();

  const items = data.items.map((it) => ({
    id: `${data.id}:${it.id}`,
    deckId: data.id,
    term: it.term,
    definition: it.definition,
    tags: it.tags ?? []
  }));

  await db.vocabItems.bulkPut(items);
  return { title: data.title, count: items.length };
}

/**
 * Import QCM exam JSON into IndexedDB.
 * Idempotent: same exam id overwrites its questions.
 */
export async function importQcmExam(data: QcmExamJson): Promise<{ title: string; count: number }> {
  await db.exams.put({
    id: data.id,
    title: data.title,
    durationSeconds: data.durationSeconds,
    createdAt: Date.now()
  });

  const prefix = `${data.id}:`;
  await db.examQuestions.where("id").startsWith(prefix).delete();

  const questions = data.questions.map((q) => ({
    id: `${data.id}:${q.id}`,
    examId: data.id,
    prompt: q.prompt,
    choices: q.choices,
    explanation: q.explanation,
    tags: q.tags ?? []
  }));

  await db.examQuestions.bulkPut(questions);
  return { title: data.title, count: questions.length };
}

/**
 * Import a sentence deck JSON into IndexedDB (SPOK).
 * Idempotent: same deck id overwrites its sentences.
 */
export async function importSentenceDeck(data: SentenceDeckJson): Promise<{ title: string; count: number }> {
  const prefix = `${data.id}:`;
  await db.sentenceExercises.where("id").startsWith(prefix).delete();

  const sentences = data.items
    .map((s) => {
      const text = s.text.trim();
      const tokens = tokenizeSentence(text);
      const translation = (s.translation ?? "").trim();
      return {
        id: `${data.id}:${s.id}`,
        text,
        translation: translation || undefined,
        tokens,
        tags: s.tags ?? [],
        createdAt: Date.now()
      };
    })
    .filter((s) => s.text.length > 0 && s.tokens.length >= 2);

  await db.sentenceExercises.bulkPut(sentences);
  return { title: data.title, count: sentences.length };
}

/**
 * Import a full bundle: vocab + QCM + phrases.
 * Useful to migrate data between machines/browsers.
 */
export async function importBundle(
    bundle: RevisionsBundleJson
): Promise<{
  decks: number;
  exams: number;
  sentenceDecks: number;
  vocabItems: number;
  qcmQuestions: number;
  sentences: number;
}> {
  let vocabItems = 0;
  let qcmQuestions = 0;
  let sentences = 0;

  // ✅ IMPORTANT: pass tables as an ARRAY to satisfy Dexie typings (avoid TS2554)
  await db.transaction(
      "rw",
      [db.vocabDecks, db.vocabItems, db.exams, db.examQuestions, db.sentenceExercises],
      async () => {
        for (const d of bundle.vocabDecks) {
          const r = await importVocabDeck(d);
          vocabItems += r.count;
        }
        for (const e of bundle.qcmExams) {
          const r = await importQcmExam(e);
          qcmQuestions += r.count;
        }
        for (const s of bundle.sentenceDecks) {
          const r = await importSentenceDeck(s);
          sentences += r.count;
        }
      }
  );

  return {
    decks: bundle.vocabDecks.length,
    exams: bundle.qcmExams.length,
    sentenceDecks: bundle.sentenceDecks.length,
    vocabItems,
    qcmQuestions,
    sentences
  };
}
