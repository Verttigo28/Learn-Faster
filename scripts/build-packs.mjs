// Builds public/packs/index.json from the pack folders.
//
// A pack is a folder in public/packs/ containing a pack.json:
//   { "id": "indonesian-fr", "uiLang": "fr", "title": "...", "description": "..." }
// and any of these sub-folders with app JSON files (one deck / exam per file):
//   vocab/   -> vocab_deck
//   qcm/     -> qcm_exam
//   phrases/ -> sentence_deck
//
// Usage: npm run packs
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../public/packs/", import.meta.url);
const rootPath = decodeURIComponent(root.pathname).replace(/^\/([A-Za-z]:)/, "$1");

const packs = [];
for (const dir of readdirSync(rootPath).sort()) {
  const packDir = join(rootPath, dir);
  if (!statSync(packDir).isDirectory() || !existsSync(join(packDir, "pack.json"))) continue;

  const meta = JSON.parse(readFileSync(join(packDir, "pack.json"), "utf8"));
  const files = [];
  const counts = { vocabDecks: 0, vocabItems: 0, exams: 0, questions: 0, sentenceDecks: 0, sentences: 0 };

  for (const sub of ["vocab", "qcm", "phrases"]) {
    const subDir = join(packDir, sub);
    if (!existsSync(subDir)) continue;
    for (const f of readdirSync(subDir).filter((n) => n.endsWith(".json")).sort()) {
      const data = JSON.parse(readFileSync(join(subDir, f), "utf8"));
      files.push(`${dir}/${sub}/${f}`);
      if (data.type === "vocab_deck") {
        counts.vocabDecks++;
        counts.vocabItems += data.items.length;
      } else if (data.type === "qcm_exam") {
        counts.exams++;
        counts.questions += data.questions.length;
      } else if (data.type === "sentence_deck") {
        counts.sentenceDecks++;
        counts.sentences += data.items.length;
      } else {
        throw new Error(`${dir}/${sub}/${f}: unknown type ${data.type}`);
      }
    }
  }

  packs.push({ ...meta, counts, files });
}

writeFileSync(join(rootPath, "index.json"), JSON.stringify({ packs }, null, 2) + "\n");
console.log(packs.map((p) => `${p.id}: ${p.files.length} files ${JSON.stringify(p.counts)}`).join("\n"));
