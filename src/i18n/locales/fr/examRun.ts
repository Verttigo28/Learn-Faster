import type en from "../en/examRun";

export default {
  notFound: "Exam introuvable",
  emptyTitle: "Exam vide",
  emptyHint: "Importe des questions dans cet exam.",
  progress: "Question {n} / {total}",
  answered: "Réponses: {answered} / {total} • 1–9 = répondre, ←/→ = naviguer",
  resultTitle: "Résultat de l'exam",
  backHome: "Retour accueil",
  review: "Revoir les corrections",
  retryMistakes: "Refaire l'erreur ({count}) | Refaire les erreurs ({count})",
  progressAria: "Questions répondues",
  reviewNote: "Les corrections restent affichées dans l’exam (bonnes réponses en vert)."
} satisfies typeof en;
