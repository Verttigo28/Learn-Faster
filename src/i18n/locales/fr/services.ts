import type en from "../en/services";

export default {
  confirmTitle: "Confirmation",
  leaveSession: "Quitter la session ? Ta progression en cours sera perdue.",
  myPhrases: "Mes phrases",
  vocabPrompt: "Traduction de : « {term} »",
  typedPrompt: "Écris la traduction de : « {term} »",
  dictationPrompt: "Écoute et écris le mot",
  dictationDetail: "Dictée ({hint})",
  interval: { minutes: "{n} min", days: "{n} j", months: "{n} mois", years: "{n} an" },
  validate: {
    root: "racine",
    object: "objet attendu",
    text: "texte attendu",
    nonEmptyText: "texte non vide requis",
    list: "liste attendue",
    textList: "liste de textes attendue",
    duplicateId: "id \"{id}\" en double",
    positiveNumber: "nombre positif attendu",
    atLeastTwoChoices: "au moins 2 choix requis",
    trueFalse: "true/false attendu",
    noCorrectChoice: "aucun choix correct",
    schemaV1: "version 1 attendue",
    number: "nombre attendu",
    unknownType: "attendu : vocab_deck / qcm_exam / sentence_deck / revisions_bundle"
  },
  pdfNoDetails: "Cette tentative ne contient pas de détails (ancienne stat). Relance une session pour générer un export PDF.",
  pdfError: "Impossible d'exporter le PDF",
  exportError: "Export impossible : {error}",
  speechUnavailable: "Dictée indisponible : synthèse vocale non supportée."
} satisfies typeof en;
