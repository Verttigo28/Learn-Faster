import type en from "../en/sentences";

export default {
  manage: {
    heading: "Phrases — ordre des mots (SPOK)",
    intro: "Crée des phrases en indonésien. L’exercice les mélange et tu dois les remettre dans le bon ordre.",
    deckLabel: "Deck (choisis ou tape un nouveau nom)",
    sentenceLabel: "Phrase (indonésien)",
    sentencePlaceholder: "ex: Aku liburan ke Indonesia",
    translationLabel: "Traduction (français)",
    translationPlaceholder: "ex: Je pars en vacances en Indonésie",
    tagsPlaceholder: "spok, vacances, grammaire",
    launchExam: "Se lancer dans un exam",
    listTitle: "Liste des phrases",
    allDecks: "Tous les decks",
    deleteDeck: "Supprimer le deck",
    emptyTitle: "Aucune phrase",
    emptyHint: "Ajoute ta première phrase à gauche.",
    translation: "💬 Traduction : {text}",
    editButton: "Modifier",
    editModal: "Modifier la phrase",
    writeSentence: "Écris une phrase.",
    tooShort: "Phrase trop courte (au moins 2 mots).",
    added: "Phrase ajoutée ✅",
    updated: "Phrase modifiée ✅",
    deleteConfirm: "Supprimer cette phrase ?",
    deleteDeckConfirm: "Supprimer le deck « {title} » et toutes ses phrases ?",
    deckDeleted: "Deck supprimé ✅"
  }
} satisfies typeof en;
