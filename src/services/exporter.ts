import { db, MANUAL_SENTENCE_DECK_ID } from "../db";
import type { VocabDeckJson, QcmExamJson, SentenceDeckJson, RevisionsBundleJson } from "../types/json";

/** Les ids stockés sont "parentId:itemId" : on retire exactement le préfixe du parent. */
function stripPrefix(id: string, parentId: string): string {
    const prefix = `${parentId}:`;
    return id.startsWith(prefix) ? id.slice(prefix.length) : id;
}

/**
 * Construit un bundle unique contenant :
 * - tous les decks vocab
 * - tous les exams QCM
 * - tous les decks de phrases SPOK
 */
export async function exportAllData(): Promise<RevisionsBundleJson> {
    const vocabDecks = await db.vocabDecks.toArray();
    const vocabItems = await db.vocabItems.toArray();

    const exams = await db.exams.toArray();
    const questions = await db.examQuestions.toArray();

    const sentenceDecks = await db.sentenceDecks.toArray();
    const sentences = await db.sentenceExercises.toArray();
    const reviews = await db.reviews.toArray();

    const vocabDeckJson: VocabDeckJson[] = vocabDecks.map((d) => ({
        type: "vocab_deck",
        id: d.id,
        title: d.title,
        from: d.from,
        to: d.to,
        items: vocabItems
            .filter((it) => it.deckId === d.id)
            .map((it) => ({
                id: stripPrefix(it.id, d.id),
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
                id: stripPrefix(q.id, e.id),
                prompt: q.prompt,
                choices: q.choices,
                explanation: q.explanation,
                tags: q.tags ?? []
            }))
    }));

    const titles = new Map(sentenceDecks.map((d) => [d.id, d.title]));
    const byDeck = new Map<string, SentenceDeckJson["items"]>();
    for (const s of sentences) {
        const deckId = s.deckId ?? MANUAL_SENTENCE_DECK_ID;
        const items = byDeck.get(deckId) ?? [];
        items.push({
            id: stripPrefix(s.id, deckId),
            text: s.text,
            translation: s.translation,
            tags: s.tags ?? []
        });
        byDeck.set(deckId, items);
    }

    // Every stored deck (even empty), plus orphan groups whose deck row is missing.
    const deckIds = [...sentenceDecks.map((d) => d.id), ...[...byDeck.keys()].filter((id) => !titles.has(id))];
    const sentenceDeckJson: SentenceDeckJson[] = deckIds.map((id) => ({
        type: "sentence_deck",
        id,
        title: titles.get(id) ?? (id === MANUAL_SENTENCE_DECK_ID ? "Mes phrases" : id),
        items: byDeck.get(id) ?? []
    }));

    return {
        type: "revisions_bundle",
        schema: 1,
        exportedAt: Date.now(),
        vocabDecks: vocabDeckJson,
        qcmExams: qcmJson,
        sentenceDecks: sentenceDeckJson,
        progress: { reviews }
    };
}
