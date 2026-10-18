<script setup lang="ts">
import { confirmDialog, toast } from "../services/dialog";
import { computed, onMounted, ref } from "vue";
import { db, type VocabDeck, type Exam } from "../db";
import EmptyState from "../components/EmptyState.vue";
import StarterPacks from "../components/StarterPacks.vue";
import { exportAllData } from "../services/exporter";
import { saveJson } from "../services/fileSave";
import { countDueToday, DAY } from "../services/srs";
import { getSetting, setSetting } from "../services/settings";
import { answersToday, streak } from "../services/stats";
import { useRouter } from "vue-router";
import { t } from "../i18n";
const router = useRouter();

const decks = ref<VocabDeck[]>([]);
const exams = ref<Exam[]>([]);
const counts = ref({
  deckCount: 0,
  examCount: 0,
  sentenceCount: 0,
  attemptCount: 0
});

async function startRandomFlashcards() {
  const count = await db.vocabDecks.count();
  if (!count) {
    toast(t("home.noDeck"), "danger");
    return;
  }

  const offset = Math.floor(Math.random() * count);
  const deck = await db.vocabDecks.orderBy("createdAt").reverse().offset(offset).limit(1).first();

  if (!deck) {
    toast(t("home.deckPickError"), "danger");
    return;
  }

  await router.push(`/deck/${deck.id}/flash`);
}

const exportInfo = ref<string>("");
const dueInfo = ref({ due: 0, fresh: 0 });
const goal = ref({ done: 0, target: 30, streak: 0 });
const lastExportAt = ref(0);
const goalPct = computed(() => Math.min(100, Math.round((goal.value.done / Math.max(1, goal.value.target)) * 100)));
/** Rappel si du contenu existe et aucun export depuis 7 jours. */
const backupDue = computed(() => {
  const hasContent = counts.value.deckCount + counts.value.examCount + counts.value.sentenceCount > 0;
  return hasContent && Date.now() - lastExportAt.value > 7 * DAY;
});
function lastExportLabel(days: number) {
  return t("home.lastExport", { days, count: days });
}
const backupLabel = computed(() =>
  lastExportAt.value ? lastExportLabel(Math.floor((Date.now() - lastExportAt.value) / DAY)) : t("home.noExportYet")
);

async function load() {
  decks.value = await db.vocabDecks.orderBy("createdAt").reverse().toArray();
  exams.value = await db.exams.orderBy("createdAt").reverse().toArray();

  counts.value = {
    deckCount: await db.vocabDecks.count(),
    examCount: await db.exams.count(),
    sentenceCount: await db.sentenceExercises.count(),
    attemptCount: await db.attempts.count()
  };
  dueInfo.value = await countDueToday();
  const attempts = await db.attempts.toArray();
  goal.value = { done: answersToday(attempts), target: await getSetting("dailyGoal"), streak: streak(attempts) };
  lastExportAt.value = await getSetting("lastExportAt");
}

async function clearAll() {
  if (!(await confirmDialog(t("home.clearAllConfirm")))) return;

  await db.transaction(
      "rw",
      db.tables,
      async () => {
        await Promise.all(db.tables.map((t) => t.clear()));
      }
  );

  await load();
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

function examDurationLabel(seconds?: number) {
  if (!seconds) return t("home.noTimer");
  const minutes = Math.round(seconds / 60);
  return t("home.minutes", { n: minutes });
}

onMounted(load);
</script>

<template>
  <div class="home">
    <!-- TOP ROW -->
    <div class="top">
      <!-- Dashboard -->
      <section class="card dashboard">
        <div class="head">
          <h2 class="title">{{ $t("home.dashboard") }}</h2>
          <div class="sub small">{{ $t("home.streak", { count: goal.streak }) }}</div>
        </div>

        <div class="goal">
          <div class="row small">
            <span>{{ $t("home.dailyGoal") }}</span>
            <span><b class="text-text">{{ goal.done }}</b> / {{ goal.target }} {{ $t("home.answers") }} {{ goalPct >= 100 ? "✅" : "" }}</span>
          </div>
          <div class="progressBar mt-1" role="progressbar" :aria-valuenow="goalPct" aria-valuemin="0" aria-valuemax="100">
            <span class="stage-mastered" :style="{ width: `${goalPct}%` }"></span>
            <span class="stage-fresh flex-1"></span>
          </div>
        </div>

        <div v-if="backupDue" class="backupHint small">
          💾 {{ backupLabel }} {{ $t("home.backupRemind") }} <button class="underline" type="button" @click="exportAll">{{ $t("home.backupLink") }}</button>{{ $t("home.backupEnd") }}
        </div>

        <div class="kpis">
          <div class="kpiBox">
            <div class="small">{{ $t("home.kpi.decks") }}</div>
            <div class="kpi">{{ counts.deckCount }}</div>
          </div>
          <div class="kpiBox">
            <div class="small">{{ $t("home.kpi.exams") }}</div>
            <div class="kpi">{{ counts.examCount }}</div>
          </div>
          <div class="kpiBox">
            <div class="small">{{ $t("home.kpi.sentences") }}</div>
            <div class="kpi">{{ counts.sentenceCount }}</div>
          </div>
          <div class="kpiBox">
            <div class="small">{{ $t("home.kpi.attempts") }}</div>
            <div class="kpi">{{ counts.attemptCount }}</div>
          </div>
        </div>

        <div class="actionsGrid">
          <router-link class="btn actionBtn" to="/import">{{ $t("home.actions.import") }}</router-link>
          <button class="btn actionBtn" @click="exportAll">{{ $t("home.actions.export") }}</button>

          <router-link class="btn actionBtn" to="/stats">{{ $t("home.actions.stats") }}</router-link>
          <router-link class="btn actionBtn" to="/sentences">{{ $t("home.actions.editSentences") }}</router-link>

          <router-link class="btn actionBtn" to="/vocab">{{ $t("home.actions.editVocab") }}</router-link>
          <router-link class="btn actionBtn" to="/qcm">{{ $t("home.actions.editQcm") }}</router-link>

          <button class="btn danger actionBtn reset" @click="clearAll">{{ $t("home.actions.reset") }}</button>

          <div class="exportHint small" v-if="exportInfo">{{ exportInfo }}</div>
        </div>
      </section>

      <!-- Start -->
      <section class="card start">
        <div class="head">
          <h2 class="title">{{ $t("common.start") }}</h2>
          <div class="sub small">{{ $t("home.quickSessions") }}</div>
        </div>

        <div class="startGrid">
          <router-link class="btn startBtn primary reviewBtn" to="/review">
            {{ $t("home.sessions.review") }}
            <span class="small">{{ $t("home.sessions.reviewInfo", { due: dueInfo.due, fresh: dueInfo.fresh }) }}</span>
          </router-link>
          <router-link class="btn startBtn" to="/exams">{{ $t("home.sessions.generateExam") }}</router-link>
          <router-link class="btn startBtn" to="/practice?count=15&sources=vocab,exam,order">{{ $t("home.sessions.exam15") }}</router-link>

          <router-link class="btn startBtn" to="/practice?count=15&sources=order">{{ $t("home.sessions.sprintSentences") }}</router-link>
          <router-link class="btn startBtn" to="/practice?count=15&sources=vocab">{{ $t("home.sessions.sprintVocab") }}</router-link>

          <router-link class="btn startBtn" to="/practice?count=15&sources=exam">{{ $t("home.sessions.sprintQcm") }}</router-link>
          <router-link class="btn startBtn" to="/practice?count=15&sources=typed&dir=both">{{ $t("home.sessions.sprintTyped") }}</router-link>
          <router-link class="btn startBtn" to="/practice?count=15&sources=cloze">{{ $t("home.sessions.sprintCloze") }}</router-link>
          <router-link class="btn startBtn" to="/practice?count=15&sources=dictation">{{ $t("home.sessions.sprintDictation") }}</router-link>
          <router-link class="btn startBtn" to="/practice?count=30&sources=vocab,exam,order">{{ $t("home.sessions.exam30") }}</router-link>

          <button class="btn startBtn" @click="startRandomFlashcards">{{ $t("home.sessions.randomFlashcards") }}</button>
        </div>
      </section>
    </div>

    <!-- No content yet: offer the starter packs -->
    <div v-if="counts.deckCount + counts.examCount + counts.sentenceCount === 0" class="emptyStart">
      <StarterPacks @installed="load" />
    </div>

    <!-- CONTENT LISTS -->
    <div v-else class="bottom">
      <section>
        <div class="sectionTitle">
          <h2>{{ $t("home.vocabDecks") }}</h2>
        </div>

        <div v-if="decks.length === 0">
          <EmptyState :title="$t('home.noDeckTitle')" :hint="$t('home.noDeckHint')" />
        </div>

        <div v-else class="listGrid">
          <router-link
              v-for="d in decks.slice(0, 3)"
              :key="d.id"
              class="card itemCard"
              :to="`/deck/${d.id}`"
          >
            <h3 class="itemTitle">{{ d.title }}</h3>

            <div class="itemFooter">
              <router-link class="badge" :to="`/deck/${d.id}/flash`">{{ $t("home.flashcards") }}</router-link>
              <span class="badge">{{ $t("common.open") }}</span>
            </div>
          </router-link>
        </div>
      </section>

      <section>
        <div class="sectionTitle">
          <h2>{{ $t("home.qcmExams") }}</h2>
        </div>

        <div v-if="exams.length === 0">
          <EmptyState :title="$t('home.noExamTitle')" :hint="$t('home.noExamHint')" />
        </div>

        <div v-else class="listGrid">
          <router-link
              v-for="e in exams.slice(0, 3)"
              :key="e.id"
              class="card itemCard"
              :to="`/exam/${e.id}`"
          >
            <h3 class="itemTitle">
              {{ e.title }}
              <span class="itemMeta">— {{ examDurationLabel(e.durationSeconds) }}</span>
            </h3>

            <div class="itemFooter">
              <span class="badge">{{ $t("common.start") }}</span>
            </div>
          </router-link>
        </div>
      </section>
    </div>
  </div>
</template>
