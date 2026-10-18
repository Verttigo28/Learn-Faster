import type en from "../en/qcm";

export default {
  titleRequired: "Titre requis.",
  durationLabel: "Durée (minutes, optionnel)",
  launchExam: "Se lancer dans un exam",
  manage: {
    heading: "QCM — gérer les exams",
    intro: "Crée un exam puis édite ses questions (choix, explications, tags).",
    newExam: "Nouvel exam",
    titlePlaceholder: "ex: Présent - négation",
    created: "Exam créé ✅",
    deleteConfirm: "Supprimer cet exam + toutes ses questions ?",
    deleted: "Exam supprimé ✅",
    listTitle: "Liste des exams",
    emptyTitle: "Aucun exam",
    emptyHint: "Crée ton premier exam à gauche, ou importe un JSON.",
    durationInfo: "Durée: {n} min"
  },
  edit: {
    notFound: "Exam introuvable",
    notFoundHint: "Retourne à la liste des exams.",
    heading: "Éditer exam",
    updated: "Exam mis à jour ✅",
    addQuestion: "Ajouter une question",
    question: "Question",
    promptPlaceholder: "Prompt…",
    explanation: "Explication (optionnel)",
    explanationPlaceholder: "Pourquoi…",
    tags: "Tags (virgules)",
    tagsPlaceholder: "negation, grammaire",
    choices: "Choix",
    choicePlaceholder: "Texte du choix",
    addChoice: "Ajouter un choix",
    addQuestionButton: "Ajouter la question",
    promptRequired: "Prompt requis.",
    twoChoicesRequired: "Au moins 2 choix requis.",
    questionAdded: "Question ajoutée ✅",
    questionUpdated: "Question mise à jour ✅",
    questionDeleteConfirm: "Supprimer cette question ?",
    questionDeleted: "Question supprimée ✅",
    questions: "Questions",
    emptyTitle: "Aucune question",
    emptyHint: "Ajoute ta première question à gauche.",
    answer: "Réponse: {answer}",
    editModal: "Modifier une question"
  }
} satisfies typeof en;
