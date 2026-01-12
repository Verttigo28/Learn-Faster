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
