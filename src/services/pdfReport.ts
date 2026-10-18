import { isTypedDetail, type Attempt, type AttemptDetail } from "../db";
import { saveFile } from "./fileSave";

export type ReportBlock = {
  index: number;
  label: string;
  correct: boolean;
  status: string;
  lines: { label: string; text: string }[];
};

export type Report = {
  title: string;
  meta: string[];
  blocks: ReportBlock[];
};

const TYPO: Record<string, string> = {
  "‘": "'", "’": "'", "“": '"', "”": '"',
  "–": "-", "—": "-", "…": "...", "•": "-", " ": " "
};

/**
 * The standard PDF fonts only cover Latin-1 (enough for FR / ID).
 * Typographic punctuation is mapped to ASCII, anything else becomes "?" instead of garbage.
 */
export function pdfSafe(s: string): string {
  let out = "";
  for (const ch of s.normalize("NFC")) {
    const mapped = TYPO[ch];
    if (mapped !== undefined) out += mapped;
    else out += (ch.codePointAt(0) ?? 0) <= 0xff ? ch : "?";
  }
  return out;
}

function detailBlock(d: AttemptDetail, index: number): ReportBlock {
  if (d.kind === "sentence_order") {
    return {
      index,
      label: "Phrase",
      correct: d.correct,
      status: d.correct ? "OK" : "Faux",
      lines: [
        { label: "Phrase", text: d.text },
        ...(d.translation ? [{ label: "FR", text: d.translation }] : []),
        { label: "Ta réponse", text: (d.answer ?? []).join(" ") || "(vide)" },
        { label: "Correction", text: (d.tokens ?? []).join(" ") }
      ]
    };
  }

  if (d.kind === "flashcard") {
    return {
      index,
      label: "Flashcard",
      correct: d.correct,
      status: d.known ? "Je sais" : "Je ne sais pas",
      lines: [
        { label: "Terme", text: d.term },
        { label: "Réponse", text: d.definition }
      ]
    };
  }

  if (isTypedDetail(d)) {
    return {
      index,
      label: d.kind === "cloze" ? "Trous" : d.kind === "dictation" ? "Dictée" : "Écrit",
      correct: d.correct,
      status: d.correct ? "OK" : "Faux",
      lines: [
        { label: "Question", text: d.prompt },
        { label: "Ta réponse", text: d.answer || "(vide)" },
        { label: "Attendu", text: d.expected }
      ]
    };
  }

  const picked = d.options.find((o) => o.id === d.pickedId)?.text ?? "aucune";
  const right = d.options.find((o) => o.correct)?.text ?? "(inconnue)";
  return {
    index,
    label: d.kind === "exam_mcq" ? "QCM" : "Vocab",
    correct: d.correct,
    status: d.correct ? "OK" : "Faux",
    lines: [
      { label: "Question", text: d.prompt },
      { label: "Ta réponse", text: picked },
      { label: "Bonne réponse", text: right },
      ...(d.kind === "exam_mcq" && d.explanation ? [{ label: "Explication", text: d.explanation }] : [])
    ]
  };
}

/** Pure (testable) description of the report content. */
export function buildReport(attempt: Attempt, title: string): Report {
  const meta = [
    `Date : ${new Date(attempt.finishedAt).toLocaleString()}`,
    `Type : ${attempt.type}   •   Score : ${Math.round(attempt.score * 100)}%`
  ];
  if (attempt.meta?.correct !== undefined && attempt.meta?.total !== undefined) {
    meta.push(`Bonnes réponses : ${attempt.meta.correct}/${attempt.meta.total}`);
  }
  if (attempt.meta?.durationSeconds !== undefined) {
    meta.push(`Durée : ${Math.max(1, Math.round(attempt.meta.durationSeconds / 60))} min`);
  }
  return {
    title: `Résultats — ${title}`,
    meta,
    blocks: (attempt.meta?.details ?? []).map((d, i) => detailBlock(d, i + 1))
  };
}

export async function renderPdf(report: Report): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const margin = 48;
  const width = doc.internal.pageSize.getWidth() - margin * 2;
  const bottom = doc.internal.pageSize.getHeight() - margin;
  let y = margin;

  const ensure = (h: number) => {
    if (y + h > bottom) {
      doc.addPage();
      y = margin;
    }
  };
  const write = (text: string, opts: { size: number; bold?: boolean; color?: [number, number, number]; indent?: number }) => {
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(opts.size);
    doc.setTextColor(...(opts.color ?? [30, 30, 30]));
    const lineH = opts.size * 1.3;
    const lines: string[] = doc.splitTextToSize(pdfSafe(text), width - (opts.indent ?? 0));
    for (const l of lines) {
      ensure(lineH);
      doc.text(l, margin + (opts.indent ?? 0), y + opts.size);
      y += lineH;
    }
  };

  write(report.title, { size: 18, bold: true });
  y += 4;
  for (const m of report.meta) write(m, { size: 10, color: [90, 90, 90] });
  y += 8;
  doc.setDrawColor(200);
  doc.line(margin, y, margin + width, y);
  y += 14;

  for (const b of report.blocks) {
    ensure(40);
    write(`${b.index}. [${b.label}]  ${b.status}`, {
      size: 11,
      bold: true,
      color: b.correct ? [20, 130, 80] : [190, 40, 40]
    });
    for (const l of b.lines) write(`${l.label} : ${l.text}`, { size: 10, indent: 14 });
    y += 10;
  }

  return doc.output("blob");
}

export async function exportAttemptPdf(attempt: Attempt, title: string): Promise<void> {
  if (!attempt.meta?.details?.length) {
    throw new Error(
        "Cette tentative ne contient pas de détails (ancienne stat). Relance un exam pour générer un export PDF."
    );
  }

  const blob = await renderPdf(buildReport(attempt, title));
  const safeDate = new Date(attempt.finishedAt).toISOString().slice(0, 10);
  const safeTitle = title.replace(/[^a-z0-9\-_ ]/gi, "").trim().replace(/\s+/g, "_").slice(0, 40);
  await saveFile(`resultats_${safeTitle || "session"}_${safeDate}.pdf`, blob);
}
