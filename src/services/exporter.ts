import { db } from "../db";
import type { VocabDeckJson, QcmExamJson, SentenceDeckJson, RevisionsBundleJson } from "../types/json";

function stripPrefix(id: string): string {
    const i = id.indexOf(":");
    return i >= 0 ? id.slice(i + 1) : id;
}

/**
 * Construit un bundle unique contenant :
 * - tous les decks vocab
 * - tous les exams QCM
 * - toutes les phrases SPOK (groupées par prefix si possible)
 */
export async function exportAllData(): Promise<RevisionsBundleJson> {
    const vocabDecks = await db.vocabDecks.toArray();
    const vocabItems = await db.vocabItems.toArray();

    const exams = await db.exams.toArray();
    const questions = await db.examQuestions.toArray();

    const sentences = await db.sentenceExercises.toArray();

    const vocabDeckJson: VocabDeckJson[] = vocabDecks.map((d) => ({
        type: "vocab_deck",
        id: d.id,
        title: d.title,
        from: d.from,
        to: d.to,
        items: vocabItems
            .filter((it) => it.deckId === d.id)
            .map((it) => ({
                id: stripPrefix(it.id),
                term: it.term,
                definition: it.definition,
                tags: it.tags ?? []
            }))
    }));

    const qcmJson: QcmExamJson[] = exams.map((e) => ({
        type: "qcm_exam",
        id: e.id,
        title: e.title,
        durationSeconds: e.durationSeconds,
        questions: questions
            .filter((q) => q.examId === e.id)
            .map((q) => ({
                id: stripPrefix(q.id),
                prompt: q.prompt,
                choices: q.choices,
                explanation: q.explanation,
                tags: q.tags ?? []
            }))
    }));

    // Group phrases by "deckId:" prefix when present, else fallback to "sentences"
    const byDeck = new Map<string, { title: string; items: SentenceDeckJson["items"] }>();

    for (const s of sentences) {
        const rawId = s.id;
        const deckKey = rawId.includes(":") ? rawId.split(":")[0] : "sentences";
        const bucket = byDeck.get(deckKey) ?? { title: deckKey === "sentences" ? "Phrases (SPOK)" : `Phrases (${deckKey})`, items: [] };

        bucket.items.push({
            id: stripPrefix(rawId),
            text: s.text,
            translation: s.translation,
            tags: s.tags ?? []
        });

        byDeck.set(deckKey, bucket);
    }

    const sentenceDecks: SentenceDeckJson[] = Array.from(byDeck.entries()).map(([id, v]) => ({
        type: "sentence_deck",
        id,
        title: v.title,
        items: v.items
    }));

    return {
        type: "revisions_bundle",
        schema: 1,
        exportedAt: Date.now(),
        vocabDecks: vocabDeckJson,
        qcmExams: qcmJson,
        sentenceDecks
    };
}

export function downloadJson(filename: string, data: unknown) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
}
