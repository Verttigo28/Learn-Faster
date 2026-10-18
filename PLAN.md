# Plan d'amélioration

Chaque phase = un commit sur la branche `improvements`, build + tests verts.

## Phase 0 — Filet de sécurité
- [x] Vitest + tests unitaires (`services/`, `utils/`) avec `fake-indexeddb`
- [x] ESLint (flat config, Vue + TS)
- [x] CI GitHub Actions : lint, type-check, test, build
- [x] Hygiène repo : `tsconfig.tsbuildinfo` hors git, scripts npm `test` / `lint`

## Phase 1 — Bugs
- [x] Ordre des mots : le mélange ne doit pas changer à chaque clic
- [x] Un seul `shuffle` Fisher–Yates partout (flashcards, phrases)
- [x] QCM vocab : pas de distracteur identique à la bonne réponse ; distracteurs du même deck en mode practice
- [x] Import/suppression par index (`deckId` / `examId`) au lieu du préfixe d'id
- [x] Vraie table `sentenceDecks` (migration Dexie v4) — le titre survit à l'export/import
- [x] Index multi-entrées `*tags`

## Phase 2 — Nettoyage
- [x] Supprimer `JsonBuilderPage.vue` (non routée) et Pinia (inutilisé)
- [x] Remplacer `alert()` / `confirm()` par un service de dialogue (toast + confirm modal)
- [x] Routes en lazy-loading
- [x] Validation stricte des JSON importés (messages d'erreur précis)

## Phase 3 — Android / natif
- [x] Export JSON + PDF via `@capacitor/filesystem` + `@capacitor/share` sur natif
- [x] PDF via `jsPDF` (mise en page fiable, chargé à la demande) à la place du générateur maison — polices standard : Latin-1 (FR / ID OK)
- [x] Avertir avant de quitter une session en cours

## Phase 4 — Répétition espacée (SRS)
- [x] Table `reviews` : état par carte (algorithme SM-2)
- [x] Les flashcards notent « À revoir / Difficile / Bien / Facile »
- [x] Accueil : « X cartes à réviser aujourd'hui » + session de révision globale

## Phase 5 — Apprentissage
- [x] Sens inverse (définition → terme) pour flashcards et quiz
- [x] Mode réponse tapée (tolérance casse / accents / espaces)
- [x] Synthèse vocale (Web Speech API) selon la langue du deck
- [x] Stats : série de jours (streak), progression par deck, mots les plus ratés, graphique 30 jours
- [x] PWA : service worker pour fonctionner hors-ligne sur le web

## Phase 6 — Nouvelles fonctionnalités
- [x] Exercice « texte à trous » (cloze) généré depuis les phrases
- [x] Dictée : l'appli prononce le mot, on l'écrit
- [x] Import CSV / TSV (export Anki / Quizlet, copier-coller tableur)
- [x] Recherche globale (vocab, QCM, phrases)
- [x] Objectif quotidien réglable + progression sur l'accueil
- [x] Thème clair / sombre
- [x] Raccourcis clavier dans les sessions (espace = retourner, 1–4 = réponse, ←/→)
- [x] Rappel de sauvegarde (date du dernier export)
