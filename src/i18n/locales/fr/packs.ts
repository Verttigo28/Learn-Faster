import type en from "../en/packs";

export default {
  title: "Packs de démarrage",
  subtitle: "Du contenu prêt à l'emploi pour commencer tout de suite.",
  counts: "{vocabItems} mots • {questions} questions de QCM • {sentences} phrases",
  install: "Installer",
  reinstall: "Mettre à jour",
  installing: "Installation… {done}/{total}",
  installed: "Pack installé ✅ {decks} decks, {exams} QCM, {sentenceDecks} decks de phrases",
  error: "Impossible d'installer le pack : {error}",
  loadError: "Impossible de charger la liste des packs.",
  forYourLanguage: "Recommandé",
  emptyTitle: "Pas encore de contenu ?",
  emptyHint: "Installe un pack de démarrage ci-dessous, ou importe tes propres decks."
} satisfies typeof en;
