export default {
  title: "Exam generator",
  intro: "One shared base: vocab + quizzes + sentences (word order). Filter by tags and the app builds the exam.",
  sources: "Sources",
  source: {
    vocab: "Vocab (generated quiz)",
    exam: "Quizzes (imported)",
    order: "Word order (SPOK)",
    typed: "Vocab (written answer)",
    cloze: "Fill in the blanks",
    dictation: "Dictation 🔊"
  },
  vocabDirection: "Vocab direction:",
  direction: {
    forward: "Term → translation",
    reverse: "Translation → term",
    both: "Both (random)"
  },
  count: "Number of questions",
  tags: "Tags",
  tagsHint: "If you don't select any tag, the exam will use all available content.",
  start: "Start the exam",
  editVocab: "Edit vocab",
  editQcm: "Edit quizzes",
  noSource: "Pick at least one source."
};
