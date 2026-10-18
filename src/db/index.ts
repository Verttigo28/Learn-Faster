import Dexie, { type Table } from "dexie";

export type VocabDeck = {
  id: string;
  title: string;
  from: string;
  to: string;
  createdAt: number;
};

export type VocabItem = {
  id: string; // unique key, e.g. "deckId:itemId"
  deckId: string;
  term: string;
  definition: string;
  tags?: string[];
  difficulty?: 1 | 2 | 3;
};

export type Exam = {
  id: string;
  title: string;
  durationSeconds?: number;
  createdAt: number;
};

export type ExamQuestion = {
  id: string; // unique key, e.g. "examId:questionId"
  examId: string;
  prompt: string;
  choices: { id: string; text: string; correct: boolean }[];
  explanation?: string;
  tags?: string[];
  difficulty?: 1 | 2 | 3;
};

export type SentenceDeck = {
  id: string;
  title: string;
  createdAt: number;
};

/** Deck par défaut des phrases créées à la main (et des anciennes phrases sans deck). */
export const MANUAL_SENTENCE_DECK_ID = "manual";

export type SentenceExercise = {
  id: string; // unique key, e.g. "deckId:sentenceId"
  deckId: string;
  text: string;
  /** Traduction FR (optionnelle) affichée en correction / aide */
  translation?: string;
  /** Traduction mot-à-mot / structurelle (ordre SPOK) */
  literal?: string;
  tokens: string[];
  tags?: string[];
  difficulty?: 1 | 2 | 3;
  createdAt: number;
};

export type AttemptDetail =
    | {
  kind: "vocab_mcq" | "exam_mcq";
  id: string;
  prompt: string;
  options: { id: string; text: string; correct: boolean }[];
  pickedId?: string;
  correct: boolean;
  explanation?: string;
}
    | {
  kind: "sentence_order";
  id: string;
  text: string;
  translation?: string;
  tokens: string[];
  answer?: string[];
  correct: boolean;
}
    | {
  /** ✅ Nouveau: détail flashcards */
  kind: "flashcard";
  id: string;
  term: string;
  definition: string;
  known: boolean;   // true = "Je sais"
  correct: boolean; // pour le filtre "erreurs" (same as known)
}
    | {
  /** Réponse tapée : traduction, texte à trous ou dictée */
  kind: "vocab_typed" | "cloze" | "dictation";
  id: string;
  prompt: string;
  expected: string;
  answer?: string;
  correct: boolean;
};

export type Attempt = {
  id: string;
  type: "vocab_quiz" | "exam" | "flashcards" | "practice" | "match";
  refId: string; // deckId / examId / "practice"
  startedAt: number;
  finishedAt: number;
  score: number; // 0..1
  meta?: {
    total?: number;
    correct?: number;
    durationSeconds?: number;
    breakdown?: Record<string, number>; // { vocab, exam, order }
    tags?: string[];
    /** Détails question par question pour export PDF */
    details?: AttemptDetail[];
  };
};

/** État de répétition espacée (SM-2) d'une carte = un item vocab dans un sens donné. */
export type ReviewState = {
  cardId: string; // itemId, or "itemId#rev" for definition -> term
  itemId: string;
  deckId: string;
  direction: "forward" | "reverse";
  ease: number;
  interval: number; // days
  reps: number;
  lapses: number;
  due: number; // ms
  introducedAt: number; // ms, first time the card was studied
  lastReviewed: number; // ms
};

export type SettingRow = { key: string; value: unknown };

/** Card format of the v4 `srsCards` table (first SRS implementation). */
type LegacySrsCard = {
  id: string;
  itemId: string;
  itemType: "vocab" | "exam" | "sentence";
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReview: number;
  lastReview: number;
};

export class AppDB extends Dexie {
  vocabDecks!: Table<VocabDeck, string>;
  vocabItems!: Table<VocabItem, string>;
  exams!: Table<Exam, string>;
  examQuestions!: Table<ExamQuestion, string>;
  sentenceDecks!: Table<SentenceDeck, string>;
  sentenceExercises!: Table<SentenceExercise, string>;
  attempts!: Table<Attempt, string>;
  reviews!: Table<ReviewState, string>;
  settings!: Table<SettingRow, string>;

  constructor(name = "revisions_db") {
    super(name);

    // v1 (original schema)
    this.version(1).stores({
      vocabDecks: "id, title, createdAt",
      vocabItems: "id, deckId",
      exams: "id, title, createdAt",
      examQuestions: "id, examId",
      attempts: "id, type, refId, startedAt"
    });

    // v2: add sentenceExercises
    this.version(2).stores({
      vocabDecks: "id, title, createdAt",
      vocabItems: "id, deckId",
      exams: "id, title, createdAt",
      examQuestions: "id, examId",
      sentenceExercises: "id, createdAt",
      attempts: "id, type, refId, startedAt"
    });

    // v3: index finishedAt (required for Stats orderBy)
    this.version(3).stores({
      vocabDecks: "id, title, createdAt",
      vocabItems: "id, deckId",
      exams: "id, title, createdAt",
      examQuestions: "id, examId",
      sentenceExercises: "id, createdAt",
      attempts: "id, type, refId, startedAt, finishedAt"
    });

    // v4 (from master): SRS cards of the first SRS implementation. Kept so databases already
    // upgraded by that build stay compatible; v6 converts its vocab cards into `reviews`.
    this.version(4).stores({
      vocabDecks: "id, title, createdAt",
      vocabItems: "id, deckId",
      exams: "id, title, createdAt",
      examQuestions: "id, examId",
      sentenceExercises: "id, createdAt",
      srsCards: "id, itemId, itemType, nextReview",
      attempts: "id, type, refId, startedAt, finishedAt"
    });

    // v5: sentence decks + deckId on sentences, multi-entry tag indexes
    this.version(5)
      .stores({
        vocabDecks: "id, title, createdAt",
        vocabItems: "id, deckId, *tags",
        exams: "id, title, createdAt",
        examQuestions: "id, examId, *tags",
        sentenceDecks: "id, title, createdAt",
        sentenceExercises: "id, deckId, createdAt, *tags",
        attempts: "id, type, refId, startedAt, finishedAt"
      })
      .upgrade(async (tx) => {
        // Old sentences had no deck: derive it from the "deckId:" id prefix, else the manual deck.
        const decks = new Map<string, SentenceDeck>();
        await tx
          .table("sentenceExercises")
          .toCollection()
          .modify((s: SentenceExercise) => {
            const i = s.id.indexOf(":");
            const deckId = i >= 0 ? s.id.slice(0, i) : MANUAL_SENTENCE_DECK_ID;
            s.deckId = deckId;
            if (!decks.has(deckId)) {
              decks.set(deckId, {
                id: deckId,
                title: deckId === MANUAL_SENTENCE_DECK_ID ? "Mes phrases" : `Phrases (${deckId})`,
                createdAt: s.createdAt ?? Date.now()
              });
            }
          });
        await tx.table("sentenceDecks").bulkPut([...decks.values()]);
      });

    // v6: spaced repetition state + key/value settings
    this.version(6)
      .stores({
        reviews: "cardId, itemId, deckId, due, introducedAt, lastReviewed",
        settings: "key"
      })
      .upgrade(async (tx) => {
        // Carry over vocab progress from the v4 srsCards table (exam / sentence cards are left as is).
        const cards = (await tx.table("srsCards").where("itemType").equals("vocab").toArray()) as LegacySrsCard[];
        if (!cards.length) return;
        const items = await tx.table("vocabItems").bulkGet(cards.map((c) => c.itemId));
        const reviews: ReviewState[] = [];
        cards.forEach((c, i) => {
          const item = items[i] as VocabItem | undefined;
          if (!item) return;
          reviews.push({
            cardId: item.id,
            itemId: item.id,
            deckId: item.deckId,
            direction: "forward",
            ease: Math.max(1.3, c.easeFactor ?? 2.5),
            interval: c.interval ?? 0,
            reps: c.repetitions ?? 0,
            lapses: 0,
            due: c.nextReview ?? 0,
            introducedAt: c.lastReview || Date.now(),
            lastReviewed: c.lastReview ?? 0
          });
        });
        await tx.table("reviews").bulkPut(reviews);
      });
  }
}

export const db = new AppDB();

export type TypedDetail = Extract<AttemptDetail, { kind: "vocab_typed" | "cloze" | "dictation" }>;

export function isTypedDetail(d: AttemptDetail): d is TypedDetail {
  return d.kind === "vocab_typed" || d.kind === "cloze" || d.kind === "dictation";
}
