import type { QcmExamJson, RevisionsBundleJson, SentenceDeckJson, VocabDeckJson } from "../types/json";

export type ImportPayload =
  | { type: "vocab_deck"; data: VocabDeckJson }
  | { type: "qcm_exam"; data: QcmExamJson }
  | { type: "sentence_deck"; data: SentenceDeckJson }
  | { type: "revisions_bundle"; data: RevisionsBundleJson };

export type ValidationResult = { ok: true; payload: ImportPayload } | { ok: false; errors: string[] };

const MAX_ERRORS = 20;

class Checker {
  errors: string[] = [];

  fail(path: string, msg: string) {
    const clean = path.replace(/^\./, "");
    if (this.errors.length < MAX_ERRORS) this.errors.push(`${clean || "racine"} : ${msg}`);
  }
  obj(x: unknown, path: string): x is Record<string, unknown> {
    if (x && typeof x === "object" && !Array.isArray(x)) return true;
    this.fail(path, "objet attendu");
    return false;
  }
  str(x: unknown, path: string, required = true): boolean {
    if (x === undefined && !required) return true;
    if (typeof x === "string" && (!required || x.trim().length > 0)) return true;
    this.fail(path, required ? "texte non vide requis" : "texte attendu");
    return false;
  }
  arr(x: unknown, path: string): x is unknown[] {
    if (Array.isArray(x)) return true;
    this.fail(path, "liste attendue");
    return false;
  }
  tags(x: unknown, path: string) {
    if (x === undefined) return;
    if (!Array.isArray(x) || x.some((t) => typeof t !== "string")) this.fail(path, "liste de textes attendue");
  }
  uniqueIds(list: unknown[], path: string) {
    const seen = new Set<string>();
    list.forEach((it, i) => {
      const id = (it as { id?: unknown })?.id;
      if (typeof id !== "string") return;
      if (seen.has(id)) this.fail(`${path}[${i}].id`, `id "${id}" en double`);
      seen.add(id);
    });
  }
}

function checkVocab(c: Checker, x: unknown, p: string) {
  if (!c.obj(x, p)) return;
  c.str(x.id, `${p}.id`);
  c.str(x.title, `${p}.title`);
  c.str(x.from, `${p}.from`);
  c.str(x.to, `${p}.to`);
  if (!c.arr(x.items, `${p}.items`)) return;
  x.items.forEach((it, i) => {
    const q = `${p}.items[${i}]`;
    if (!c.obj(it, q)) return;
    c.str(it.id, `${q}.id`);
    c.str(it.term, `${q}.term`);
    c.str(it.definition, `${q}.definition`);
    c.tags(it.tags, `${q}.tags`);
  });
  c.uniqueIds(x.items, `${p}.items`);
}

function checkQcm(c: Checker, x: unknown, p: string) {
  if (!c.obj(x, p)) return;
  c.str(x.id, `${p}.id`);
  c.str(x.title, `${p}.title`);
  if (x.durationSeconds !== undefined && (typeof x.durationSeconds !== "number" || x.durationSeconds < 0)) {
    c.fail(`${p}.durationSeconds`, "nombre positif attendu");
  }
  if (!c.arr(x.questions, `${p}.questions`)) return;
  x.questions.forEach((qq, i) => {
    const q = `${p}.questions[${i}]`;
    if (!c.obj(qq, q)) return;
    c.str(qq.id, `${q}.id`);
    c.str(qq.prompt, `${q}.prompt`);
    c.str(qq.explanation, `${q}.explanation`, false);
    c.tags(qq.tags, `${q}.tags`);
    if (!c.arr(qq.choices, `${q}.choices`)) return;
    if (qq.choices.length < 2) c.fail(`${q}.choices`, "au moins 2 choix requis");
    let correct = 0;
    qq.choices.forEach((ch, j) => {
      const r = `${q}.choices[${j}]`;
      if (!c.obj(ch, r)) return;
      c.str(ch.id, `${r}.id`);
      c.str(ch.text, `${r}.text`);
      if (typeof ch.correct !== "boolean") c.fail(`${r}.correct`, "true/false attendu");
      if (ch.correct === true) correct++;
    });
    if (correct === 0) c.fail(`${q}.choices`, "aucun choix correct");
    c.uniqueIds(qq.choices, `${q}.choices`);
  });
  c.uniqueIds(x.questions, `${p}.questions`);
}

function checkSentences(c: Checker, x: unknown, p: string) {
  if (!c.obj(x, p)) return;
  c.str(x.id, `${p}.id`);
  c.str(x.title, `${p}.title`);
  if (!c.arr(x.items, `${p}.items`)) return;
  x.items.forEach((it, i) => {
    const q = `${p}.items[${i}]`;
    if (!c.obj(it, q)) return;
    c.str(it.id, `${q}.id`);
    c.str(it.text, `${q}.text`);
    c.str(it.translation, `${q}.translation`, false);
    c.tags(it.tags, `${q}.tags`);
  });
  c.uniqueIds(x.items, `${p}.items`);
}

/** Validates parsed JSON before import, with precise error paths (e.g. "items[3].term"). */
export function validateImport(x: unknown): ValidationResult {
  const c = new Checker();
  if (!c.obj(x, "")) return { ok: false, errors: c.errors };

  switch (x.type) {
    case "vocab_deck":
      checkVocab(c, x, "");
      break;
    case "qcm_exam":
      checkQcm(c, x, "");
      break;
    case "sentence_deck":
      checkSentences(c, x, "");
      break;
    case "revisions_bundle":
      if (x.schema !== 1) c.fail("schema", "version 1 attendue");
      if (x.progress !== undefined) {
        const reviews = c.obj(x.progress, "progress") ? x.progress.reviews : undefined;
        if (c.arr(reviews ?? [], "progress.reviews")) {
          (reviews as unknown[] | undefined)?.forEach((r, i) => {
            const p = `progress.reviews[${i}]`;
            if (!c.obj(r, p)) return;
            c.str(r.cardId, `${p}.cardId`);
            c.str(r.itemId, `${p}.itemId`);
            for (const k of ["ease", "interval", "reps", "lapses", "due"]) {
              if (typeof r[k] !== "number") c.fail(`${p}.${k}`, "nombre attendu");
            }
          });
        }
      }
      for (const [key, check] of [
        ["vocabDecks", checkVocab],
        ["qcmExams", checkQcm],
        ["sentenceDecks", checkSentences]
      ] as const) {
        const list = x[key] ?? [];
        if (c.arr(list, key)) list.forEach((d, i) => check(c, d, `${key}[${i}]`));
      }
      break;
    default:
      c.fail("type", "attendu : vocab_deck / qcm_exam / sentence_deck / revisions_bundle");
  }

  if (c.errors.length) return { ok: false, errors: c.errors };

  if (x.type === "revisions_bundle") {
    // Missing sections are tolerated (treated as empty).
    const data = {
      ...x,
      exportedAt: typeof x.exportedAt === "number" ? x.exportedAt : Date.now(),
      vocabDecks: x.vocabDecks ?? [],
      qcmExams: x.qcmExams ?? [],
      sentenceDecks: x.sentenceDecks ?? []
    } as RevisionsBundleJson;
    return { ok: true, payload: { type: "revisions_bundle", data } };
  }
  return { ok: true, payload: { type: x.type, data: x } as ImportPayload };
}
