import type en from "../en/settings";

export default {
  title: "Réglages",
  language: "Langue",
  srs: "Répétition espacée",
  newPerDay: "Nouvelles cartes par jour",
  newPerDayHint: "Les cartes à revoir sont toujours proposées ; ce réglage limite seulement les nouvelles.",
  goal: "Objectif quotidien",
  goalLabel: "Nombre de réponses par jour",
  appearance: "Apparence",
  dark: "🌙 Sombre",
  light: "☀️ Clair",
  system: "🖥️ Système",
  audio: "Audio",
  autoSpeak: "Lire automatiquement les flashcards à voix haute",
  backup: "Sauvegarde",
  lastExport: "Dernier export :",
  never: "jamais",
  backupHint: "Les données restent dans ce navigateur / cet appareil : exporte-les régulièrement depuis l'accueil.",
  saved: "Réglages enregistrés ✅",
  exportNow: "Exporter mes données (JSON)",
  exported: "Données exportées ✅",
  danger: "Zone de danger",
  resetAll: "Supprimer toutes les données",
  resetHint: "Supprime tous les decks, QCM, phrases, révisions et statistiques de cet appareil. Exporte d'abord si tu veux les garder.",
  resetConfirm: "Supprimer tous les decks, QCM, phrases, révisions et stats de cet appareil ? Action irréversible.",
  resetDone: "Toutes les données ont été supprimées"
} satisfies typeof en;
