# Learn faster!

An **offline-first** app to learn a language (built for Indonesian, works for any language) with flashcards, spaced repetition, quizzes and sentence exercises. Everything is stored locally in the browser / on the device (IndexedDB) — no account, no server.

Available as a **web app (PWA, works offline)** and an **Android app** (Capacitor). The interface is in **English and French**, and new languages are easy to add (see [Translating the app](#translating-the-app)).

## Features

- **Vocabulary decks** with tags, editable in the app
- **Spaced repetition (SM-2)**: daily review across all decks, 4 answer levels (Again / Hard / Good / Easy) with the next interval shown, reverse direction (translation → term), configurable new cards per day
- **Exercises**: multiple choice, **typed answers** (tolerant to case, accents, listed alternatives and one typo), **word order**, **cloze** (fill in the blank), **dictation** (text-to-speech)
- **Quizzes (QCM)** with explanations and an optional timer
- **Session generator** by tags and sources (vocab / quizzes / sentences / typed / cloze / dictation)
- **Stats**: streak, 30-day activity chart, per-deck progress (new / learning / mastered), hardest words, full history with per-question corrections and **PDF export**
- **Import / export**: JSON (single deck or full backup including SRS progress), **CSV / TSV** (Anki "Notes in Plain Text", Quizlet, spreadsheets), from a file, a URL or pasted text
- **Starter packs**: one click installs a complete Indonesian course (see below)
- Global search, daily goal, backup reminder, light / dark / system theme, keyboard shortcuts

## Starter packs

`public/packs/` ships ready-to-use Indonesian content, installable from the home page:

| Pack | Vocabulary | Grammar quizzes | Sentences |
|---|---|---|---|
| Indonesian for English speakers (`indonesian-en`) | 34 themed decks, ~1,700 words (A1 → B1) | 18 exams, ~390 questions with explanations | 20 decks, ~540 everyday sentences |
| Indonésien pour francophones (`indonesian-fr`) | same content with French definitions | same, explained in French | same, French translations |

A pack is a folder with a `pack.json` and `vocab/`, `qcm/`, `phrases/` sub-folders containing regular import files (formats below). After adding or editing files run `npm run packs` to rebuild `public/packs/index.json`; `npm test` validates every pack file with the app's import validator.

## Getting started

Requirements: Node.js (LTS) and npm.

```bash
npm install
npm run dev          # dev server
npm test             # unit / component tests (Vitest + fake-indexeddb)
npm run test:e2e     # end-to-end tests (Playwright, desktop + mobile)
npm run lint         # ESLint
npm run build        # type-check + production build (+ PWA service worker)
npm run packs        # rebuild the starter packs manifest
```

GitHub Actions runs lint, tests and the build on every push / pull request.

### Android (Capacitor)

```bash
npm run build
npx cap sync android   # copies the build and plugins (filesystem, share, status-bar)
npx cap open android
```

On Android, exports (JSON / PDF) open the system share sheet (save to Files, Drive, e-mail…).

## Import formats

Supported JSON `type`s: `vocab_deck`, `qcm_exam`, `sentence_deck`, `revisions_bundle` (full backup). Invalid files are rejected with precise error paths (e.g. `items[3].term`) and nothing is imported.

```json
{ "type": "vocab_deck", "id": "id-food", "title": "Food", "from": "id", "to": "en",
  "items": [{ "id": "1", "term": "makan", "definition": "to eat", "tags": ["verb", "a1"] }] }

{ "type": "qcm_exam", "id": "negation", "title": "Negation", "durationSeconds": 600,
  "questions": [{ "id": "1", "prompt": "Negate a verb?", "explanation": "tidak + verb",
    "choices": [{ "id": "a", "text": "tidak", "correct": true }, { "id": "b", "text": "bukan", "correct": false }] }] }

{ "type": "sentence_deck", "id": "restaurant", "title": "At the restaurant",
  "items": [{ "id": "1", "text": "Saya mau makan nasi goreng.", "translation": "I want to eat fried rice." }] }
```

Definitions may list alternatives accepted in typed answers: `"eat / have a meal"`. Re-importing a deck with the same id replaces its content and keeps spaced-repetition progress for items that still exist.

CSV / TSV (vocab): columns `term`, `definition`, optional `tags` (space, `|` or `,` separated); the separator is detected automatically, a header row and Anki `#` directives are skipped.

## Keyboard shortcuts

- Flashcards: `Space` flip, `1`–`4` grade
- Quizzes: `1`–`9` answer, `←` / `→` navigate
- Generated sessions: `Enter` check / next, `1`–`9` pick an answer

## Translating the app

UI strings live in `src/i18n/locales/<code>/` (one file per area: `home.ts`, `stats.ts`…). English is the source of truth and every other language is type-checked against it, so a missing key fails `npm run build`.

To add a language:

1. Copy `src/i18n/locales/en` to `src/i18n/locales/<code>` (e.g. `id`, `es`).
2. Translate the strings. Keep the keys and `{placeholders}`; `"one | other"` are plural forms.
3. Register it in `src/i18n/locales/index.ts` (`name` is how the language calls itself).

In code: `$t("home.title")` in templates, `t("stats.entries", { count })` in scripts (`import { t } from "../i18n"`). The language is detected from the device and can be changed in Settings.

## Project structure

```
src/
  db/          Dexie schema and migrations (IndexedDB)
  services/    import/export, validation, spaced repetition, practice engine, stats, PDF, packs…
  pages/       one Vue component per route
  components/  shared UI (modal, dialogs, chart, word-order exercise)
  i18n/        translations
public/packs/  starter content
tests/         Vitest unit and component tests
e2e/           Playwright end-to-end tests
```

## Notes

- Data is local: clearing the browser storage deletes it. Export regularly (the home page reminds you after 7 days).
- PDF export uses standard fonts (Latin characters only).
