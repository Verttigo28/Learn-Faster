import { createRouter, createWebHistory } from "vue-router";

import HomePage from "../pages/HomePage.vue";
import ImportPage from "../pages/ImportPage.vue";
import StatsPage from "../pages/StatsPage.vue";
import DeckPage from "../pages/DeckPage.vue";
import FlashcardsPage from "../pages/FlashcardsPage.vue";
import VocabQuizPage from "../pages/VocabQuizPage.vue";
import ExamPage from "../pages/ExamPage.vue";

import ExamsPage from "../pages/ExamsPage.vue";
import PracticePage from "../pages/PracticePage.vue";
import SentencesManagePage from "../pages/SentencesManagePage.vue";
import VocabManagePage from "../pages/VocabManagePage.vue";
import VocabEditPage from "../pages/VocabEditPage.vue";
import QcmManagePage from "../pages/QcmManagePage.vue";
import QcmEditPage from "../pages/QcmEditPage.vue";
import AttemptResultPage from "../pages/AttemptResultPage.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: HomePage },
    { path: "/import", component: ImportPage },
    { path: "/sentences", component: SentencesManagePage },
    { path: "/vocab", component: VocabManagePage },
    { path: "/vocab/:deckId/edit", component: VocabEditPage, props: true },
    { path: "/qcm", component: QcmManagePage },
    { path: "/qcm/:examId/edit", component: QcmEditPage, props: true },
    { path: "/exams", component: ExamsPage },
    { path: "/practice", component: PracticePage },
    { path: "/stats", component: StatsPage },

    { path: "/attempt/:attemptId", component: AttemptResultPage, props: true },

    // deckId is passed as prop to avoid param parsing inside pages
    { path: "/deck/:deckId", component: DeckPage, props: true },
    { path: "/deck/:deckId/flash", component: FlashcardsPage, props: true },
    { path: "/deck/:deckId/quiz", component: VocabQuizPage, props: true },

    { path: "/exam/:examId", component: ExamPage, props: true }
  ]
});
