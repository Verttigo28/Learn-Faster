import type { Attempt, AttemptDetail } from "../db";

/**
 * PDF minimal (sans dépendances) :
 * - Police Helvetica (Base14)
 * - Texte uniquement
 * - Multi-pages si besoin
 *
 * ✅ Fix accents : Helvetica doit être déclarée avec /Encoding /WinAnsiEncoding
 * ✅ Fix mise en page : wrap des lignes longues + séparateurs
 */
function escapePdfText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function chunkLines(lines: string[], perPage = 52): string[][] {
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += perPage) pages.push(lines.slice(i, i + perPage));
  return pages.length ? pages : [[]];
}

// --- Encodage WinAnsi (CP1252) ---
const CP1252_EXT: Record<number, number> = {
  0x20ac: 0x80,
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c,
  0x017d: 0x8e,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02dc: 0x98,
  0x2122: 0x99,
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c,
  0x017e: 0x9e,
  0x0178: 0x9f
};

function encodePdf(s: string): Uint8Array {
  const out: number[] = [];
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0;
    if (code <= 0xff) out.push(code);
    else if (CP1252_EXT[code] !== undefined) out.push(CP1252_EXT[code]);
    else out.push(0x3f); // '?'
  }
  return new Uint8Array(out);
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((acc, c) => acc + c.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

/** Wrap simple par mots, avec conservation d'indentation ("   "). */
function wrapLine(line: string, maxLen = 92): string[] {
  if (line.length <= maxLen) return [line];

  // conserve indentation
  const indentMatch = line.match(/^\s+/);
  const indent = indentMatch ? indentMatch[0] : "";
  const text = line.slice(indent.length);

  const words = text.split(/\s+/);
  const out: string[] = [];
  let cur = "";

  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if ((indent.length + next.length) <= maxLen) {
      cur = next;
    } else {
      if (cur) out.push(indent + cur);
      // mot trop long => on le coupe brutalement
      if ((indent.length + w.length) > maxLen) {
        let rest = w;
        while ((indent.length + rest.length) > maxLen) {
          out.push(indent + rest.slice(0, maxLen - indent.length));
          rest = rest.slice(maxLen - indent.length);
        }
        cur = rest;
      } else {
        cur = w;
      }
    }
  }

  if (cur) out.push(indent + cur);
  return out;
}

function wrapLines(lines: string[], maxLen = 92): string[] {
  const out: string[] = [];
  for (const l of lines) out.push(...wrapLine(l, maxLen));
  return out;
}

/** Construit un PDF A4 (595x842) à partir d'une liste de pages/lines. */
function buildPdf(pages: string[][]): Uint8Array {
  const objects: string[] = [];
  const offsets: number[] = [];

  // header + binaire comment (octets > 127)
  const header = "%PDF-1.4\n%âãÏÓ\n";

  // 1) Catalog
  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  // 2) Pages (kids filled after page objs are created)
  objects.push("2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n");

  // 3) Font (Helvetica) ✅ IMPORTANT: /Encoding /WinAnsiEncoding (fix accents)
  objects.push(
      "3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n"
  );

  const pageObjIds: number[] = [];

  let nextId = 4;
  for (const pageLines of pages) {
    const pageId = nextId++;
    const contentId = nextId++;
    pageObjIds.push(pageId);

    const fontSize = 11;
    const leading = 14;
    const startX = 50;
    const startY = 800;

    const linesText = pageLines
        .map((l) => `(${escapePdfText(l)}) Tj\nT*`)
        .join("\n");

    const stream =
        `BT\n/F1 ${fontSize} Tf\n${leading} TL\n1 0 0 1 ${startX} ${startY} Tm\n${linesText}\nET\n`;

    // /Length en octets (WinAnsi), pas en nb de chars
    const streamLen = encodePdf(stream).length;

    const content =
        `${contentId} 0 obj\n<< /Length ${streamLen} >>\nstream\n${stream}endstream\nendobj\n`;
    objects.push(content);

    const page =
        `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`;
    objects.push(page);
  }

  // Replace Pages object with correct kids/count
  const kids = pageObjIds.map((id) => `${id} 0 R`).join(" ");
  objects[1] = `2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pageObjIds.length} >>\nendobj\n`;

  // Build final PDF with xref (offsets en octets)
  const chunks: Uint8Array[] = [];
  const headerBytes = encodePdf(header);
  chunks.push(headerBytes);
  offsets.push(0);

  const xrefEntries: string[] = ["0000000000 65535 f "];

  let cursor = headerBytes.length;
  for (const obj of objects) {
    offsets.push(cursor);
    const b = encodePdf(obj);
    chunks.push(b);
    cursor += b.length;
  }

  const xrefStart = cursor;
  for (let i = 1; i < offsets.length; i++) {
    xrefEntries.push(`${String(offsets[i]).padStart(10, "0")} 00000 n `);
  }

  const xref = `xref\n0 ${xrefEntries.length}\n${xrefEntries.join("\n")}\n`;
  const trailer = `trailer\n<< /Size ${xrefEntries.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  chunks.push(encodePdf(xref + trailer));

  return concatBytes(chunks);
}

function downloadPdf(filename: string, bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy.buffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Helpers */
function isMcq(d: AttemptDetail): d is Extract<AttemptDetail, { kind: "vocab_mcq" | "exam_mcq" }> {
  return d.kind === "vocab_mcq" || d.kind === "exam_mcq";
}
function isFlashcard(d: AttemptDetail): d is Extract<AttemptDetail, { kind: "flashcard" }> {
  return d.kind === "flashcard";
}

function asLines(title: string, attempt: Attempt, details: AttemptDetail[]): string[] {
  const dt = new Date(attempt.finishedAt);

  const lines: string[] = [];
  const sep = "-".repeat(86);

  lines.push(`Résultats — ${title}`);
  lines.push(`Date : ${dt.toLocaleString()}`);
  lines.push(`Type : ${attempt.type}   Score : ${Math.round(attempt.score * 100)}%`);

  if (attempt.meta?.correct !== undefined && attempt.meta?.total !== undefined) {
    lines.push(`Bonnes réponses : ${attempt.meta.correct}/${attempt.meta.total}`);
  }

  if (attempt.meta?.durationSeconds !== undefined) {
    const m = Math.round(attempt.meta.durationSeconds / 60);
    lines.push(`Durée : ${m} min`);
  }

  lines.push(sep);
  lines.push(" ");

  details.forEach((d, i) => {
    const n = i + 1;

    if (d.kind === "sentence_order") {
      lines.push(`${n}. [Phrase] ${d.correct ? "OK" : "KO"}`);
      lines.push(`   Phrase : ${d.text}`);
      if (d.translation) lines.push(`   FR : ${d.translation}`);
      const user = (d.answer ?? []).join(" ");
      const corr = (d.tokens ?? []).join(" ");
      lines.push(`   Ta réponse : ${user || "(vide)"}`);
      lines.push(`   Correction : ${corr}`);
      lines.push(" ");
      return;
    }

    if (isFlashcard(d)) {
      // Flashcards : on affiche surtout "Je sais / Je ne sais pas"
      lines.push(`${n}. [Flashcard] ${d.known ? "Je sais" : "Je ne sais pas"}`);
      lines.push(`   Terme : ${d.term}`);
      lines.push(`   Réponse : ${d.definition}`);
      lines.push(" ");
      return;
    }

    if (isMcq(d)) {
      const picked = d.options?.find((o) => o.id === d.pickedId)?.text ?? "aucune";
      const corr = d.options?.find((o) => o.correct)?.text ?? "(inconnue)";

      lines.push(`${n}. [${d.kind === "exam_mcq" ? "QCM" : "Vocab"}] ${d.correct ? "OK" : "KO"}`);
      lines.push(`   Q : ${d.prompt}`);
      lines.push(`   Ta réponse : ${picked}`);
      lines.push(`   Bonne réponse : ${corr}`);
      if (d.kind === "exam_mcq" && d.explanation) lines.push(`   Explication : ${d.explanation}`);
      lines.push(" ");
      return;
    }

    // fallback vieux records
    lines.push(`${n}. [Inconnu] `);
    lines.push(" ");
  });

  return wrapLines(lines, 92);
}

export function exportAttemptPdf(attempt: Attempt, title: string) {
  const details = attempt.meta?.details ?? [];
  if (!details.length) {
    throw new Error(
        "Cette tentative ne contient pas de détails (ancienne stat). Relance un exam pour générer un export PDF."
    );
  }

  const lines = asLines(title, attempt, details);
  const pages = chunkLines(lines, 52);
  const bytes = buildPdf(pages);

  const safeDate = new Date(attempt.finishedAt).toISOString().slice(0, 10);
  const safeTitle = title.replace(/[^a-z0-9\-_ ]/gi, "").trim().replace(/\s+/g, "_").slice(0, 40);

  downloadPdf(`resultats_${safeTitle}_${safeDate}.pdf`, bytes);
}
