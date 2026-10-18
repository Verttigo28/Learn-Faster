import type en from "../en/attempt";

export default {
  result: "Résultat",
  examFallback: "Exam {id}",
  deckFallback: "Deck {id}",
  flashcardsFallback: "Flashcards {id}",
  practiceTitle: "Exam (tags)",
  reviewTitle: "Révision du jour",
  notFound: "Résultat introuvable",
  notFoundHint: "Cette tentative n'existe plus dans la base locale.",
  backToStats: "Retour stats",
  onlyWrong: "Voir seulement les erreurs",
  noDetails: "Aucun détail",
  noDetailsHint: "Cette tentative est trop ancienne. Relance un exam pour enregistrer les détails.",
  translation: "FR: {text}",
  status: "Statut"
} satisfies typeof en;
