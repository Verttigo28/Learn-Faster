/**
 * Minimal CSV/TSV parser: quoted fields ("a, b" and "" escapes), CRLF, delimiter auto-detection.
 */
export function detectDelimiter(text: string): string {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith("#")).slice(0, 10);
  const candidates = ["\t", ";", ","];
  let best = ",";
  let bestScore = -1;
  for (const d of candidates) {
    const counts = lines.map((l) => l.split(d).length - 1);
    const min = counts.length ? Math.min(...counts) : 0;
    // consistent count across lines wins; tab > ; > , on ties
    const score = min > 0 ? min * 10 + (counts.every((c) => c === counts[0]) ? 5 : 0) : 0;
    if (score > bestScore) {
      best = d;
      bestScore = score;
    }
  }
  return best;
}

export function parseDelimited(text: string, delimiter = detectDelimiter(text)): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"' && field === "") quoted = true;
    else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function stripHtml(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

const HEADER_WORDS = /^(term|terme|mot|word|front|recto|question|source|id|indon[eé]sien)$/i;

export type VocabRow = { term: string; definition: string; tags: string[] };

/**
 * Rows -> vocab: col 1 = terme, col 2 = définition, col 3 (optionnelle) = tags (séparés par espace, | ou ,).
 * Skips Anki "#..." directive lines, a header row, and incomplete rows.
 */
export function rowsToVocab(text: string): { rows: VocabRow[]; skipped: number } {
  const clean = text.split(/\r?\n/).filter((l) => !l.startsWith("#")).join("\n");
  const parsed = parseDelimited(clean).filter((r) => r.some((c) => c.trim()));
  let skipped = 0;
  const rows: VocabRow[] = [];
  parsed.forEach((r, i) => {
    const term = stripHtml(r[0] ?? "");
    const definition = stripHtml(r[1] ?? "");
    if (i === 0 && HEADER_WORDS.test(term)) return;
    if (!term || !definition) {
      skipped++;
      return;
    }
    const tags = stripHtml(r[2] ?? "").split(/[\s|,]+/).map((t) => t.trim()).filter(Boolean);
    rows.push({ term, definition, tags });
  });
  return { rows, skipped };
}
