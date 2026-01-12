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
};

export type SentenceExercise = {
  id: string;
  text: string;
  /** Traduction FR (optionnelle) affichée en correction / aide */
  translation?: string;
  tokens: string[];
  tags?: string[];
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
};

export type Attempt = {
  id: string;
  type: "vocab_quiz" | "exam" | "flashcards" | "practice";
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

export class AppDB extends Dexie {
  vocabDecks!: Table<VocabDeck, string>;
  vocabItems!: Table<VocabItem, string>;
  exams!: Table<Exam, string>;
  examQuestions!: Table<ExamQuestion, string>;
  sentenceExercises!: Table<SentenceExercise, string>;
  attempts!: Table<Attempt, string>;

  constructor() {
    super("revisions_db");

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
  }
}

export const db = new AppDB();
