<script setup lang="ts">
import { toast } from "../services/dialog";
import { computed, onMounted, ref } from "vue";
import { db, type VocabDeck, type Exam } from "../db";
import StarterPacks from "../components/StarterPacks.vue";
import { exportAllData } from "../services/exporter";
import { saveJson } from "../services/fileSave";
import { countDueToday, DAY, endOfDay } from "../services/srs";
import { getSetting, setSetting } from "../services/settings";
import { answersToday, deckProgress, streak, type DeckProgress } from "../services/stats";
import { speechSupported } from "../services/speech";
import { intlLocale, t } from "../i18n";

type DeckRow = { deck: VocabDeck; progress: DeckProgress; due: number };
type ExamRow = { exam: Exam; questions: number };

const loaded = ref(false);
const hasContent = ref(false);
const deckRows = ref<DeckRow[]>([]);
const examRows = ref<ExamRow[]>([]);
const deckCount = ref(0);
const examCount = ref(0);
const dueInfo = ref({ due: 0, fresh: 0 });
const goal = ref({ done: 0, target: 30, streak: 0 });
const masteredTotal = ref(0);
const lastExportAt = ref(0);

const toReview = computed(() => dueInfo.value.due + dueInfo.value.fresh);
const goalPct = computed(() => Math.min(100, Math.round((goal.value.done / Math.max(1, goal.value.target)) * 100)));
const todayLabel = computed(() =>
  new Date().toLocaleDateString(intlLocale(), { weekday: "long", day: "numeric", month: "long" })
);

/** Reminder when there is content and no export for 7 days. */
const backupDue = computed(() => hasContent.value && Date.now() - lastExportAt.value > 7 * DAY);
const backupLabel = computed(() => {
  if (!lastExportAt.value) return t("home.noExportYet");
  const days = Math.floor((Date.now() - lastExportAt.value) / DAY);
  return t("home.lastExport", { days, count: days });
});

const canSpeak = speechSupported();
const modes = computed(() => [
  { key: "mixed", to: "/practice?count=15&sources=vocab,exam,order" },
  { key: "typed", to: "/practice?count=15&sources=typed&dir=both" },
  { key: "match", to: "/match" },
  { key: "order", to: "/practice?count=15&sources=order" },
  { key: "cloze", to: "/practice?count=15&sources=cloze" },
  ...(canSpeak ? [{ key: "dictation", to: "/practice?count=15&sources=dictation" }] : [])
]);

// Goal ring geometry
const R = 26;
const CIRC = 2 * Math.PI * R;

async function load() {
  const [decks, exams, items, questions, reviews, sentenceCount, attempts] = await Promise.all([
    db.vocabDecks.toArray(),
    db.exams.toArray(),
    db.vocabItems.toArray(),
    db.examQuestions.toArray(),
    db.reviews.toArray(),
    db.sentenceExercises.count(),
    db.attempts.toArray()
  ]);

  hasContent.value = decks.length + exams.length + sentenceCount > 0;
  deckCount.value = decks.length;
  examCount.value = exams.length;

  const progress = new Map(deckProgress(items, reviews).map((p) => [p.deckId, p]));
  const limit = endOfDay(Date.now());
  const due = new Map<string, number>();
  for (const r of reviews) {
    if (r.direction === "forward" && r.due <= limit) due.set(r.deckId, (due.get(r.deckId) ?? 0) + 1);
  }
  masteredTotal.value = [...progress.values()].reduce((n, p) => n + p.mastered, 0);
  deckRows.value = decks
    .map((deck) => ({
      deck,
      progress: progress.get(deck.id) ?? { deckId: deck.id, total: 0, fresh: 0, learning: 0, mastered: 0 },
      due: due.get(deck.id) ?? 0
    }))
    .sort((a, b) => b.due - a.due || b.progress.learning - a.progress.learning || a.deck.title.localeCompare(b.deck.title))
    .slice(0, 5);

  const qCount = new Map<string, number>();
  for (const q of questions) qCount.set(q.examId, (qCount.get(q.examId) ?? 0) + 1);
  examRows.value = exams
    .sort((a, b) => b.createdAt - a.createdAt || a.title.localeCompare(b.title))
    .slice(0, 5)
    .map((exam) => ({ exam, questions: qCount.get(exam.id) ?? 0 }));

  dueInfo.value = await countDueToday();
  goal.value = { done: answersToday(attempts), target: await getSetting("dailyGoal"), streak: streak(attempts) };
  lastExportAt.value = await getSetting("lastExportAt");
  loaded.value = true;
}

async function exportAll() {
  const data = await exportAllData();
  const date = new Date().toISOString().slice(0, 10);
  try {
    await saveJson(`revisions_export_${date}.json`, data);
    lastExportAt.value = Date.now();
    await setSetting("lastExportAt", lastExportAt.value);
  } catch (e) {
    toast(t("services.exportError", { error: e instanceof Error ? e.message : t("home.unknownError") }), "danger");
  }
}

function pct(n: number, total: number) {
  return total ? `${(n / total) * 100}%` : "0%";
}

function examTime(seconds?: number) {
  return seconds ? t("home.minutes", { n: Math.round(seconds / 60) }) : t("home.noTimer");
}

onMounted(load);
</script>

<template>
  <div class="home">
    <template v-if="!loaded"></template>

    <!-- First visit: no content yet -->
    <template v-else-if="!hasContent">
      <section class="card">
        <h1>{{ $t("home.welcome") }}</h1>
        <p class="small">{{ $t("home.welcomeHint") }}</p>
      </section>
      <div class="emptyStart">
        <StarterPacks @installed="load" />
      </div>
    </template>

    <template v-else>
      <div class="homeTop">
        <!-- Today -->
        <section class="card todayCard" aria-labelledby="today-title">
          <div class="todayHead">
            <div>
              <h1 id="today-title" class="m-0">{{ $t("home.today") }}</h1>
              <div class="todayDate">{{ todayLabel }}</div>
            </div>
          </div>

          <router-link
            v-if="toReview > 0"
            class="reviewCta"
            to="/review"
            :aria-label="`${$t('home.reviewLabel')} — ${$t('home.reviewInfo', { due: dueInfo.due, fresh: dueInfo.fresh })}`"
          >
            <div>
              <div class="big">{{ toReview }}</div>
              <div class="label">{{ $t("home.toReview", { count: toReview }) }}</div>
              <div class="text-sm opacity-80">{{ $t("home.reviewLabel") }} · {{ $t("home.reviewInfo", { due: dueInfo.due, fresh: dueInfo.fresh }) }}</div>
            </div>
            <span class="go">{{ $t("home.startReview") }}</span>
          </router-link>
          <div v-else class="reviewCta done">
            <div>
              <div class="label text-lg">✓ {{ $t("home.allDone") }}</div>
              <div class="text-sm text-muted">{{ $t("home.allDoneHint") }}</div>
            </div>
          </div>

          <div class="todayStats">
            <div class="todayStat goalTile flex items-center gap-3">
              <div class="goalRing" role="progressbar" :aria-valuenow="goalPct" aria-valuemin="0" aria-valuemax="100" :aria-label="$t('home.goal')">
                <svg viewBox="0 0 64 64" aria-hidden="true">
                  <circle cx="32" cy="32" :r="R" fill="none" stroke="rgb(var(--border) / .12)" stroke-width="7" />
                  <circle
                    cx="32" cy="32" :r="R" fill="none" stroke="rgb(var(--accent))" stroke-width="7" stroke-linecap="round"
                    :stroke-dasharray="CIRC" :stroke-dashoffset="CIRC * (1 - goalPct / 100)"
                  />
                </svg>
                <span class="val">{{ goalPct }}%</span>
              </div>
              <div class="min-w-0">
                <div class="small">{{ $t("home.goal") }}</div>
                <div class="font-bold">{{ $t("home.goalValue", { done: goal.done, target: goal.target }) }}</div>
              </div>
            </div>
            <div class="todayStat">
              <div class="small">{{ $t("home.streak") }}</div>
              <div class="kpi mt-1">{{ goal.streak }}</div>
              <div class="small">{{ $t("home.streakUnit", { count: goal.streak }) }}</div>
            </div>
            <div class="todayStat">
              <div class="small">{{ $t("home.mastered") }}</div>
              <div class="kpi mt-1">{{ masteredTotal }}</div>
              <div class="small">{{ $t("home.masteredUnit", { count: masteredTotal }) }}</div>
            </div>
          </div>

          <div v-if="backupDue" class="backupHint">
            💾 {{ backupLabel }} {{ $t("home.backupRemind") }}
            <button class="underline font-bold" type="button" @click="exportAll">{{ $t("home.backupLink") }}</button>{{ $t("home.backupEnd") }}
          </div>
        </section>

        <!-- Practice -->
        <section class="card flex flex-col gap-3" aria-labelledby="practice-title">
          <h2 id="practice-title" class="m-0">{{ $t("home.practice") }}</h2>
          <div class="modeGrid">
            <router-link v-for="m in modes" :key="m.key" class="modeTile" :to="m.to">
              <span class="t">{{ $t(`home.modes.${m.key}.t`) }}</span>
              <span class="d">{{ $t(`home.modes.${m.key}.d`) }}</span>
            </router-link>
          </div>
          <router-link class="btn ghost self-start" to="/exams">{{ $t("home.customSession") }}</router-link>
        </section>
      </div>

      <div class="homeLists">
        <section class="card" aria-labelledby="decks-title">
          <div class="sectionHead">
            <h2 id="decks-title">{{ $t("home.yourDecks") }}</h2>
            <router-link class="small underline" to="/vocab">{{ $t("home.allDecks") }} ({{ deckCount }})</router-link>
          </div>
          <div class="list gap-0.5">
            <router-link v-for="r in deckRows" :key="r.deck.id" class="deckRow" :to="`/deck/${encodeURIComponent(r.deck.id)}`">
              <div class="main">
                <div class="name">{{ r.deck.title }}</div>
                <div class="progressBar mt-1.5 h-1.5" role="img" :aria-label="`${r.progress.mastered} / ${r.progress.total}`">
                  <span v-if="r.progress.mastered" class="stage-mastered" :style="{ width: pct(r.progress.mastered, r.progress.total) }"></span>
                  <span v-if="r.progress.learning" class="stage-learning" :style="{ width: pct(r.progress.learning, r.progress.total) }"></span>
                  <span v-if="r.progress.fresh" class="stage-fresh" :style="{ width: pct(r.progress.fresh, r.progress.total) }"></span>
                </div>
              </div>
              <span v-if="r.due" class="dueDot">{{ r.due }}</span>
              <span v-else class="small whitespace-nowrap">{{ $t("home.deckWords", { count: r.progress.total }) }}</span>
            </router-link>
          </div>
        </section>

        <section class="card" aria-labelledby="quizzes-title">
          <div class="sectionHead">
            <h2 id="quizzes-title">{{ $t("home.quizzes") }}</h2>
            <router-link class="small underline" to="/qcm">{{ $t("home.allQuizzes") }} ({{ examCount }})</router-link>
          </div>
          <div class="list gap-0.5">
            <router-link v-for="e in examRows" :key="e.exam.id" class="deckRow" :to="`/exam/${encodeURIComponent(e.exam.id)}`">
              <div class="main">
                <div class="name">{{ e.exam.title }}</div>
                <div class="small">{{ $t("home.quizMeta", { count: e.questions, time: examTime(e.exam.durationSeconds) }) }}</div>
              </div>
              <span class="small whitespace-nowrap">{{ $t("common.start") }}</span>
            </router-link>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>
