import { createRouter, createWebHistory } from "vue-router";
import HomePage from "../pages/HomePage.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: HomePage },
    { path: "/import", component: () => import("../pages/ImportPage.vue") },
    { path: "/sentences", component: () => import("../pages/SentencesManagePage.vue") },
    { path: "/vocab", component: () => import("../pages/VocabManagePage.vue") },
    { path: "/vocab/:deckId/edit", component: () => import("../pages/VocabEditPage.vue"), props: true },
    { path: "/qcm", component: () => import("../pages/QcmManagePage.vue") },
    { path: "/qcm/:examId/edit", component: () => import("../pages/QcmEditPage.vue"), props: true },
    { path: "/exams", component: () => import("../pages/ExamsPage.vue") },
    { path: "/practice", component: () => import("../pages/PracticePage.vue") },
    { path: "/stats", component: () => import("../pages/StatsPage.vue") },

    { path: "/attempt/:attemptId", component: () => import("../pages/AttemptResultPage.vue"), props: true },

    // deckId is passed as prop to avoid param parsing inside pages
    { path: "/deck/:deckId", component: () => import("../pages/DeckPage.vue"), props: true },
    { path: "/deck/:deckId/flash", component: () => import("../pages/FlashcardsPage.vue"), props: true },
    { path: "/deck/:deckId/quiz", component: () => import("../pages/VocabQuizPage.vue"), props: true },

    { path: "/exam/:examId", component: () => import("../pages/ExamPage.vue"), props: true },

    { path: "/:pathMatch(.*)*", redirect: "/" }
  ]
});
