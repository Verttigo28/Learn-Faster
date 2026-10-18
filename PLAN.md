# Improvement plan

One commit per phase on the `improvements` branch, with build and tests green.

## Phase 0 — Safety net
- [x] Vitest + unit tests (`services/`, `utils/`) with `fake-indexeddb`
- [x] ESLint (flat config, Vue + TS)
- [x] GitHub Actions CI: lint, type-check, tests, build
- [x] Repo hygiene: `tsconfig.tsbuildinfo` out of git, `test` / `lint` npm scripts

## Phase 1 — Bugs
- [x] Word order: the shuffle no longer changes on every click
- [x] One Fisher–Yates `shuffle` everywhere (flashcards, sentences)
- [x] Vocab MCQ: no distractor identical to the right answer; same-deck distractors in practice mode
- [x] Import / delete by index (`deckId` / `examId`) instead of the id prefix
- [x] Real `sentenceDecks` table (Dexie v4 migration) — the title survives export / import
- [x] Multi-entry `*tags` indexes

## Phase 2 — Cleanup
- [x] Remove `JsonBuilderPage.vue` (not routed) and Pinia (unused)
- [x] Replace `alert()` / `confirm()` with a dialog service (toast + confirm modal)
- [x] Lazy-loaded routes
- [x] Strict validation of imported JSON (precise error messages)

## Phase 3 — Android / native
- [x] JSON + PDF export through `@capacitor/filesystem` + `@capacitor/share` on native
- [x] PDF via `jsPDF` (reliable layout, loaded on demand) instead of the hand-written generator — standard fonts: Latin-1
- [x] Warn before leaving a session in progress

## Phase 4 — Spaced repetition (SRS)
- [x] `reviews` table: per-card state (SM-2)
- [x] Flashcards graded Again / Hard / Good / Easy
- [x] Home: "X cards to review today" + global review session

## Phase 5 — Learning
- [x] Reverse direction (definition → term) for flashcards and quizzes
- [x] Typed answers (tolerant to case / accents / spaces)
- [x] Text-to-speech (Web Speech API) based on the deck language
- [x] Stats: streak, per-deck progress, hardest words, 30-day chart
- [x] PWA: service worker to work offline on the web

## Phase 6 — New features
- [x] Cloze exercise generated from sentences
- [x] Dictation: the app speaks the word, you type it
- [x] CSV / TSV import (Anki / Quizlet export, spreadsheet copy-paste)
- [x] Global search (vocab, quizzes, sentences)
- [x] Configurable daily goal + progress on the home page
- [x] Light / dark theme
- [x] Keyboard shortcuts in sessions (space = flip, 1–4 = answer, ←/→)
- [x] Backup reminder (date of the last export)

## Phase 7 — Quality, languages, content
- [x] Independent review of the branch; fixed: route reuse in flashcards, early-review interval inflation, double grading, theme preview, empty sentence decks in export, DST start of day
- [x] Playwright end-to-end tests (desktop + mobile)
- [x] i18n: English + French UI, type-checked locale files, easy to add a language
- [x] README in English
- [x] Indonesian starter packs (English + French editions): 34 vocab decks (~1,700 words), 18 grammar quizzes (~390 questions), 20 sentence decks (~540 sentences), one-click install
- [x] Mobile: single-row scrollable navigation

## Ideas for later
- Accept several valid word orders for sentences that allow it
- Upgrade the dev toolchain (Vite 6+, Vitest 4, Tailwind 4) to clear the remaining dev-only audit warnings
- Optional sync between devices
