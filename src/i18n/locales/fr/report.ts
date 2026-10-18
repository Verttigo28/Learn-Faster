import type en from "../en/report";

export default {
  title: "Résultats — {title}",
  date: "Date : {date}",
  typeScore: "Type : {type}   •   Score : {score}%",
  correct: "Bonnes réponses : {correct}/{total}",
  duration: "Durée : {n} min",
  ok: "OK",
  wrong: "Faux",
  known: "Je sais",
  unknown: "Je ne sais pas",
  kinds: { sentence: "Phrase", flashcard: "Flashcard", qcm: "QCM", vocab: "Vocab", cloze: "Trous", dictation: "Dictée", typed: "Écrit" },
  labels: {
    sentence: "Phrase",
    translation: "Traduction",
    yourAnswer: "Ta réponse",
    correction: "Correction",
    term: "Terme",
    answer: "Réponse",
    question: "Question",
    rightAnswer: "Bonne réponse",
    explanation: "Explication",
    expected: "Attendu"
  }
} satisfies typeof en;
