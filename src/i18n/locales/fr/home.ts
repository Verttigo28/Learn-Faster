import type en from "../en/home";

export default {
  noDeck: "Aucun deck vocab. Crée ou importe un deck d'abord.",
  deckPickError: "Impossible de sélectionner un deck.",
  lastExport: "Dernier export il y a {days} jour(s).",
  noExportYet: "Aucun export pour l'instant.",
  clearAllConfirm: "Tout supprimer (decks/exams/phrases/stats) ?",
  unknownError: "erreur inconnue",
  noTimer: "Sans timer",
  minutes: "{n} min",
  dashboard: "Tableau de bord",
  streak: "🔥 {count} jour(s) de suite",
  dailyGoal: "Objectif du jour",
  answers: "réponses",
  backupRemind: "Pense à",
  backupLink: "exporter tes données",
  backupEnd: ".",
  kpi: {
    decks: "Decks vocab",
    exams: "Exams",
    sentences: "Phrases",
    attempts: "Tentatives"
  },
  actions: {
    import: "📥 Importer",
    export: "⬇️ Exporter",
    stats: "📈 Stats",
    editSentences: "🧩 Éditer phrases",
    editVocab: "🗂️ Éditer vocab",
    editQcm: "📝 Éditer QCM",
    reset: "🧹 Reset DB"
  },
  quickSessions: "Sessions rapides",
  sessions: {
    review: "🧠 Révision du jour",
    reviewInfo: "{due} à revoir • {fresh} nouvelles",
    generateExam: "🎯 Générer un examen",
    exam15: "⚡ Exam 15 questions VQP",
    sprintSentences: "🧩 Sprint 15 phrases",
    sprintVocab: "🗂️ Sprint 15 vocab",
    sprintQcm: "📝 Sprint 15 QCM",
    sprintTyped: "✍️ Sprint 15 vocab écrit",
    sprintCloze: "🕳️ Sprint 15 textes à trous",
    sprintDictation: "🎧 Sprint 15 dictées",
    exam30: "🔥 Exam 30 questions VQP",
    randomFlashcards: "🃏 Flashcards (aléatoire)"
  },
  vocabDecks: "Decks vocab",
  noDeckTitle: "Aucun deck vocab",
  noDeckHint: "Importe un deck en JSON.",
  flashcards: "Flashcards",
  qcmExams: "Exams QCM",
  noExamTitle: "Aucun exam",
  noExamHint: "Importe un QCM en JSON."
} satisfies typeof en;
