import { importBundle } from "./importer";
import { validateImport } from "./validate";
import type { QcmExamJson, RevisionsBundleJson, SentenceDeckJson, VocabDeckJson } from "../types/json";

/** Starter content shipped in public/packs (see scripts/build-packs.mjs). */
export type PackInfo = {
  id: string;
  /** Language of the definitions / translations (matches the UI locale codes). */
  uiLang: string;
  title: string;
  description: string;
  counts: { vocabDecks: number; vocabItems: number; exams: number; questions: number; sentenceDecks: number; sentences: number };
  files: string[];
};

function packsUrl(path: string): string {
  return `${import.meta.env.BASE_URL}packs/${path}`;
}

export async function listPacks(): Promise<PackInfo[]> {
  const res = await fetch(packsUrl("index.json"));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { packs: PackInfo[] };
  return data.packs;
}

/** Packs whose translations match the UI language first. */
export function sortPacksFor(packs: PackInfo[], uiLang: string): PackInfo[] {
  return [...packs].sort((a, b) => Number(b.uiLang === uiLang) - Number(a.uiLang === uiLang));
}

/**
 * Downloads every file of the pack, validates it, then imports everything in one transaction.
 * Re-installing is idempotent (same ids overwrite) and keeps spaced-repetition progress.
 */
export async function installPack(
  pack: PackInfo,
  onProgress?: (done: number, total: number) => void
): Promise<Awaited<ReturnType<typeof importBundle>>> {
  const bundle: RevisionsBundleJson = {
    type: "revisions_bundle",
    schema: 1,
    exportedAt: Date.now(),
    vocabDecks: [] as VocabDeckJson[],
    qcmExams: [] as QcmExamJson[],
    sentenceDecks: [] as SentenceDeckJson[]
  };

  let done = 0;
  const results = await Promise.all(
    pack.files.map(async (file) => {
      const res = await fetch(packsUrl(file));
      if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
      const json: unknown = await res.json();
      onProgress?.(++done, pack.files.length);
      return { file, json };
    })
  );

  for (const { file, json } of results) {
    const v = validateImport(json);
    if (!v.ok) throw new Error(`${file}: ${v.errors[0]}`);
    const p = v.payload;
    if (p.type === "vocab_deck") bundle.vocabDecks.push(p.data);
    else if (p.type === "qcm_exam") bundle.qcmExams.push(p.data);
    else if (p.type === "sentence_deck") bundle.sentenceDecks.push(p.data);
  }

  return importBundle(bundle);
}
