import type en from "../en/practice";

export default {
  emptyTitle: "Rien à réviser",
  literal: "Mot à mot : {text}",
  emptyHint: "Aucune question ne correspond aux filtres. Ajoute du contenu ou change les tags.",
  backGenerator: "Retour générateur",
  import: "Importer",
  addSentences: "Ajouter des phrases",
  title: "Exam (tags)",
  progress: "Question {n} / {total}",
  tags: "Tags: {tags}",
  orderTitle: "Remets la phrase dans le bon ordre",
  correct: "✅ Correct",
  almost: "✅ Presque (petite faute)",
  incorrect: "❌ Incorrect",
  correctSentence: "Phrase correcte :",
  replay: "🔊 Réécouter",
  clozeTitle: "Complète la phrase",
  placeholder: "Ta réponse… (Entrée pour valider)",
  expected: "Réponse attendue :",
  meaning: "Sens : {hint}",
  shortcuts: "Entrée = valider / suivant • 1–9 = choisir une réponse • ordre des mots : clique un mot pour l’ajouter, puis dans “Ta réponse” pour l’enlever.",
  resultTitle: "Résultat (exam tags)",
  newFilter: "Nouveau filtre",
  backHome: "Retour accueil",
  savedNote: "Cette session est sauvegardée dans Stats (type: practice).",
  breakdown: {
    vocab: "Vocab",
    exam: "QCM",
    order: "SPOK",
    typed: "Écrit",
    cloze: "Trous",
    dictation: "Dictée"
  },
  order: {
    instruction: "Mets les mots dans le bon ordre (S-P-O-K).",
    yourAnswer: "Ta réponse",
    clickWords: "Clique les mots ci-dessous…",
    shuffled: "Mots (désordre)"
  }
} satisfies typeof en;
