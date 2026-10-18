import type en from "../en/search";

export default {
  title: "Recherche",
  placeholder: "Mot, traduction, question, tag… (sans accents ni majuscules)",
  summary: "{total} résultat(s) — Vocab {vocab} • QCM {qcm} • Phrases {sentence}",
  minChars: "Tape au moins 2 caractères.",
  noResults: "Aucun résultat",
  noResultsHint: "Essaie un autre mot ou un tag.",
  kind: {
    vocab: "Vocab",
    qcm: "QCM",
    sentence: "Phrase"
  }
} satisfies typeof en;
