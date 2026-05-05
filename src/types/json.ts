export type VocabItemJson = {
  id: string;
  term: string;
  definition: string;
  tags?: string[];
  /** Difficulty 1 (easy) to 3 (hard) */
  difficulty?: 1 | 2 | 3;
};

export type VocabDeckJson = {
  type: "vocab_deck";
  id: string;
  title: string;
  from: string;
  to: string;
  /** Schema version of this deck */
  version?: number;
  /** Last update timestamp */
  updatedAt?: number;
  items: VocabItemJson[];
};

export type QcmQuestionJson = {
  id: string;
  prompt: string;
  choices: { id: string; text: string; correct: boolean }[];
  explanation?: string;
  tags?: string[];
  difficulty?: 1 | 2 | 3;
};

export type QcmExamJson = {
  type: "qcm_exam";
  id: string;
  title: string;
  durationSeconds?: number;
  version?: number;
  updatedAt?: number;
  questions: QcmQuestionJson[];
};

export type SentenceItemJson = {
  id: string;
  text: string;
  /** Natural translation */
  translation?: string;
  /** Word-by-word / structural translation (e.g. SPOK order) */
  literal?: string;
  tags?: string[];
  difficulty?: 1 | 2 | 3;
};

export type SentenceDeckJson = {
  type: "sentence_deck";
  id: string;
  title: string;
  version?: number;
  updatedAt?: number;
  items: SentenceItemJson[];
};

export type RevisionsBundleJson = {
  type: "revisions_bundle";
  schema: 1;
  exportedAt: number;
  vocabDecks: VocabDeckJson[];
  qcmExams: QcmExamJson[];
  sentenceDecks: SentenceDeckJson[];
};

export function isVocabDeckJson(x: any): x is VocabDeckJson {
  return x?.type === "vocab_deck" && typeof x?.id === "string" && Array.isArray(x?.items);
}

export function isQcmExamJson(x: any): x is QcmExamJson {
  return x?.type === "qcm_exam" && typeof x?.id === "string" && Array.isArray(x?.questions);
}

export function isSentenceDeckJson(x: any): x is SentenceDeckJson {
  return x?.type === "sentence_deck" && typeof x?.id === "string" && Array.isArray(x?.items);
}

export function isRevisionsBundleJson(x: any): x is RevisionsBundleJson {
  return (
      x?.type === "revisions_bundle" &&
      x?.schema === 1 &&
      typeof x?.exportedAt === "number" &&
      Array.isArray(x?.vocabDecks) &&
      Array.isArray(x?.qcmExams) &&
      Array.isArray(x?.sentenceDecks)
  );
}
