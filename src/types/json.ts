import type { ReviewState } from "../db";

export type VocabDeckJson = {
  type: "vocab_deck";
  id: string;
  title: string;
  from: string;
  to: string;
  items: { id: string; term: string; definition: string; tags?: string[] }[];
};

export type QcmExamJson = {
  type: "qcm_exam";
  id: string;
  title: string;
  durationSeconds?: number;
  questions: {
    id: string;
    prompt: string;
    choices: { id: string; text: string; correct: boolean }[];
    explanation?: string;
    tags?: string[];
  }[];
};

export type SentenceDeckJson = {
  type: "sentence_deck";
  id: string;
  title: string;
  items: { id: string; text: string; translation?: string; tags?: string[] }[];
};

export type RevisionsBundleJson = {
  type: "revisions_bundle";
  schema: 1;
  exportedAt: number;
  vocabDecks: VocabDeckJson[];
  qcmExams: QcmExamJson[];
  sentenceDecks: SentenceDeckJson[];
  /** Progression SRS (optionnelle) : permet de migrer l'appli sans perdre les révisions. */
  progress?: { reviews: ReviewState[] };
};
