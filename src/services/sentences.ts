import { db, MANUAL_SENTENCE_DECK_ID, type SentenceDeck } from "../db";
import { uid } from "../utils/id";
import { tokenizeSentence } from "../utils/sentence";

/** Returns the deck with this title (case-insensitive), creating it if needed. Empty title => manual deck. */
export async function ensureSentenceDeck(title: string): Promise<SentenceDeck> {
  const t = title.trim();
  const decks = await db.sentenceDecks.toArray();

  if (!t) {
    const manual = decks.find((d) => d.id === MANUAL_SENTENCE_DECK_ID);
    if (manual) return manual;
    const created = { id: MANUAL_SENTENCE_DECK_ID, title: "Mes phrases", createdAt: Date.now() };
    await db.sentenceDecks.put(created);
    return created;
  }

  const found = decks.find((d) => d.title.toLocaleLowerCase() === t.toLocaleLowerCase());
  if (found) return found;

  const created = { id: uid("sdeck"), title: t, createdAt: Date.now() };
  await db.sentenceDecks.add(created);
  return created;
}

export async function addSentence(input: {
  deckTitle: string;
  text: string;
  translation?: string;
  tags: string[];
}): Promise<void> {
  const deck = await ensureSentenceDeck(input.deckTitle);
  const text = input.text.trim();
  const tr = (input.translation ?? "").trim();
  await db.sentenceExercises.add({
    id: `${deck.id}:${uid("sent")}`,
    deckId: deck.id,
    text,
    translation: tr || undefined,
    tokens: tokenizeSentence(text),
    tags: input.tags,
    createdAt: Date.now()
  });
}

/** Deletes a sentence deck and all its sentences. */
export async function removeSentenceDeck(deckId: string): Promise<void> {
  await db.transaction("rw", [db.sentenceDecks, db.sentenceExercises], async () => {
    await db.sentenceDecks.delete(deckId);
    await db.sentenceExercises.where("deckId").equals(deckId).delete();
  });
}
