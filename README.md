# Révisions — Appli offline (Vue 3 + Vite)

Application de révision **100% locale** (offline) pour apprendre (ex. indonésien) avec :
- **Vocabulaire** (decks + items)
- **QCM** (examens importés)
- **Phrases** (ordre des mots / SPOK)
- **Générateur d’exam par tags**
- **Historique des tentatives** + **détails de correction** + **export PDF**
- **Répétition espacée (SM-2)** : révision du jour, 4 niveaux de réponse, sens inverse
- **Réponse écrite**, **texte à trous**, **dictée** (synthèse vocale)
- **Stats** : série de jours, activité 30 jours, progression par deck, mots difficiles
- **Recherche globale**, **objectif quotidien**, **thème clair / sombre**, **PWA hors-ligne**

Les données sont stockées dans le navigateur via **IndexedDB (Dexie)**.

---

## Prérequis

- Node.js (LTS recommandé)
- npm

---

## Installation

```bash
npm install
```

### Démarrer en local

```bash
npm run dev
```

### Build & preview

```bash
npm run build
npm run preview
```

---

## Import / Export

### Import
L’import peut se faire depuis :
- un **fichier JSON**
- une **URL JSON**
- du **texte JSON collé**

Types JSON supportés :
- `vocab_deck`
- `qcm_exam`
- `sentence_deck`
- `revisions_bundle`

### Import CSV / TSV (vocab)
- Page Import, carte de droite : export Anki (« Notes en texte brut »), Quizlet ou copier-coller tableur.
- Colonnes : terme, définition, tags (optionnel). Séparateur (tab, `;`, `,`) détecté automatiquement.
- Ajoute au deck choisi (les doublons exacts sont ignorés) ou crée un nouveau deck.

### Export
- Export global JSON (bundle) pour sauvegarde / transfert.
- Le bundle inclut la progression SRS (`progress.reviews`) : migrer d'appareil ne fait pas perdre les révisions.
- Sur Android, l'export (JSON / PDF) ouvre la feuille de partage (Enregistrer dans Fichiers, Drive, mail…).
- Rappel sur l'accueil si aucun export depuis 7 jours.

---

## Édition des données

- `/vocab` : gérer les decks vocab + édition des items (termes, définitions, tags)
- `/qcm` : gérer les examens QCM + édition des questions/choix
- `/sentences` : gérer les phrases (ordre des mots) + traduction + tags

---

## Entraînement / Examens

- Exam QCM “classique”
- Sessions “par tags” (mix possible : vocab / QCM / phrases SPOK)

Comportements notables :
- Mélange des questions et des choix (shuffle)
- Option d’aide pour les phrases (affichage de la traduction) lors des sessions

---

## Résultats & PDF

- Historique des tentatives (Stats)
- Page de résultat détaillée par tentative :
    - bon/faux
    - réponse choisie + bonne réponse
    - explication (QCM) si disponible
    - traduction (phrases) si disponible
- Export PDF d’une tentative (si les détails ont été enregistrés)

---

## Tags & Générateur d’exam

Les `tags` peuvent être utilisés pour filtrer et générer des sessions.
Ils s’appliquent à :
- items vocab
- questions QCM
- phrases (SPOK)

Le générateur construit automatiquement une session selon les sources sélectionnées et les tags.

---

## Développement

```bash
npm run dev        # serveur de dev
npm test           # tests (Vitest + fake-indexeddb)
npm run lint       # ESLint
npm run build      # type-check + build (+ service worker PWA)
```

La CI GitHub Actions exécute lint, tests et build à chaque push / PR.

Raccourcis clavier : flashcards `Espace` (retourner) et `1`–`4` (noter) ; exams `1`–`9` (répondre), `←`/`→` ; sessions par tags `Entrée` (valider / suivant).

---

## Android (Capacitor)

```bash
npm run build
npx cap sync android   # copie le build + plugins (filesystem, share, status-bar)
npx cap open android
```

---

## Notes

- Tout est stocké localement (IndexedDB). Vider le stockage du navigateur effacera les données.
- Certaines traductions de phrases peuvent être absentes selon les imports ; l’app continue de fonctionner sans.
