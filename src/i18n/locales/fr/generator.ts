import type en from "../en/generator";

export default {
  title: "Générateur d'exam",
  intro: "Une base commune : vocab + QCM + phrases (ordre des mots). Tu filtres par tags, et l'app construit l'exam.",
  sources: "Sources",
  source: {
    vocab: "Vocab (QCM généré)",
    exam: "QCM (importés)",
    order: "Ordre des mots (SPOK)",
    typed: "Vocab (réponse écrite)",
    cloze: "Texte à trous",
    dictation: "Dictée 🔊"
  },
  vocabDirection: "Sens du vocab :",
  direction: {
    forward: "Terme → traduction",
    reverse: "Traduction → terme",
    both: "Les deux (aléatoire)"
  },
  count: "Nombre de questions",
  tags: "Tags",
  tagsHint: "Si tu ne sélectionnes aucun tag, l’exam utilisera tout le contenu disponible.",
  start: "Démarrer l’exam",
  editVocab: "Éditer vocab",
  editQcm: "Éditer QCM",
  noSource: "Choisis au moins une source.",
  tagSearch: "Chercher un tag…",
  levels: "Niveau",
  selected: "{count} sélectionné | {count} sélectionnés",
  clear: "Effacer",
  noTagMatch: "Aucun tag ne correspond à la recherche.",
  noTags: "Pas encore de tags : importe du contenu avec des tags.",
  matching: "{count} élément correspondant | {count} éléments correspondants"
} satisfies typeof en;
