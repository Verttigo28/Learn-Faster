<script setup lang="ts">
import { confirmDialog, toast } from "../services/dialog";
import { computed, onMounted, onUnmounted, ref } from "vue";
import { db, type Attempt, type VocabDeck, type Exam, type ReviewState, type VocabItem } from "../db";
import ActivityChart from "../components/ActivityChart.vue";
import ActivityHeatmap from "../components/ActivityHeatmap.vue";
import { activityByDay, bestStreak, deckProgress, hardestWords, streak } from "../services/stats";
import EmptyState from "../components/EmptyState.vue";
import { formatDate, formatDuration } from "../utils/time";
import { exportAttemptPdf } from "../services/pdfReport";
import { t } from "../i18n";

const attempts = ref<Attempt[]>([]);
const decks = ref<Record<string, VocabDeck>>({});
const exams = ref<Record<string, Exam>>({});
const items = ref<VocabItem[]>([]);
const reviews = ref<ReviewState[]>([]);
const tab = ref<"history" | "decks" | "hard" | "chart">("history");

const streakDays = computed(() => streak(attempts.value));
const bestStreakDays = computed(() => bestStreak(attempts.value));
const activity = computed(() => activityByDay(attempts.value, 30));
const progress = computed(() => deckProgress(items.value, reviews.value));
const hard = computed(() => hardestWords(items.value, reviews.value, 15));

function pct(n: number, total: number) {
  return total ? `${(n / total) * 100}%` : "0%";
}

function percent01(x: number) {
  return `${Math.round(x * 100)}%`;
}

const totalAttempts = computed(() => attempts.value.length);

const avgScore01 = computed(() => {
  if (!attempts.value.length) return 0;
  return attempts.value.reduce((acc, a) => acc + a.score, 0) / attempts.value.length;
});

const last7Score01 = computed(() => {
  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const recent = attempts.value.filter((a) => a.finishedAt >= weekAgo);
  if (!recent.length) return 0;
  return recent.reduce((acc, a) => acc + a.score, 0) / recent.length;
});

function titleFor(a: Attempt): string {
  if (a.type === "exam") return exams.value[a.refId]?.title ?? t("stats.examFallback", { id: a.refId });
  if (a.type === "practice") return t("stats.practiceTitle");
  if (a.type === "flashcards" && a.refId === "review") return t("stats.reviewTitle");
  if (a.type === "match" && a.refId === "all") return t("stats.matchTitle");
  return decks.value[a.refId]?.title ?? t("stats.deckFallback", { id: a.refId });
}

function metaLine(a: Attempt): string {
  const parts: string[] = [];
  if (a.meta?.durationSeconds !== undefined) parts.push(`⏱ ${formatDuration(a.meta.durationSeconds)}`);
  if (a.meta?.correct !== undefined && a.meta?.total !== undefined) parts.push(`✅ ${a.meta.correct}/${a.meta.total}`);
  if (a.type === "practice" && a.meta?.breakdown) {
    const b = a.meta.breakdown;
    const labels: Record<string, string> = {
      vocab: t("report.kinds.vocab"),
      exam: t("report.kinds.qcm"),
      order: t("stats.spok"),
      typed: t("report.kinds.typed"),
      cloze: t("report.kinds.cloze"),
      dictation: t("report.kinds.dictation")
    };
    parts.push(Object.entries(b).filter(([, n]) => n).map(([k, n]) => `${labels[k] ?? k}:${n}`).join(" "));
  }
  if (a.type === "practice" && a.meta?.tags?.length) {
    parts.push(t("stats.tagsLine", { tags: a.meta.tags.join(", ") }));
  }
  return parts.join(" • ");
}

async function load() {
  attempts.value = await db.attempts.orderBy("finishedAt").reverse().toArray();

  const d = await db.vocabDecks.toArray();
  decks.value = Object.fromEntries(d.map((x) => [x.id, x]));

  const e = await db.exams.toArray();
  exams.value = Object.fromEntries(e.map((x) => [x.id, x]));
  items.value = await db.vocabItems.toArray();
  reviews.value = await db.reviews.toArray();
}

async function clearStats() {
  if (!(await confirmDialog(t("stats.confirmClear")))) return;
  await db.attempts.clear();
  await load();
}

function canOpenResult(a: Attempt): boolean {
  if (a.type === "flashcards") return true;
  return !!a.meta?.details?.length;
}


async function exportPdf(a: Attempt) {
  try {
    await exportAttemptPdf(a, titleFor(a));
  } catch (e) {
    toast(e instanceof Error ? e.message : t("services.pdfError"), "danger");
  }
}

function lockScroll() {
  document.documentElement.classList.add("no-scroll");
  document.body.classList.add("no-scroll");
}
function unlockScroll() {
  document.documentElement.classList.remove("no-scroll");
  document.body.classList.remove("no-scroll");
}

onMounted(() => {
  lockScroll();
  load();
});
onUnmounted(unlockScroll);

</script>

<template>
  <div class="statsPage">
    <div class="statsTop">
      <div class="card">
        <h2>{{ $t("stats.activity") }}</h2>
        <ActivityHeatmap :attempts="attempts" :weeks="20" />
      </div>

      <div class="card kpiCard">
        <h2>{{ $t("stats.title") }}</h2>
        <div class="kpiGrid">
          <div>
            <div class="small">{{ $t("stats.attempts") }}</div>
            <div class="kpi">{{ totalAttempts }}</div>
          </div>
          <div>
            <div class="small">{{ $t("stats.avgScore") }}</div>
            <div class="kpi">{{ percent01(avgScore01) }}</div>
          </div>
          <div>
            <div class="small">{{ $t("stats.last7Days") }}</div>
            <div class="kpi">{{ percent01(last7Score01) }}</div>
          </div>
          <div>
            <div class="small">{{ $t("stats.streak") }}</div>
            <div class="kpi">{{ $t("stats.streakValue", { count: streakDays }) }}</div>
          </div>
          <div>
            <div class="small">{{ $t("stats.bestStreak") }}</div>
            <div class="kpi">{{ $t("stats.bestStreakValue", { count: bestStreakDays }) }}</div>
          </div>
        </div>
        <div class="hr"></div>
        <button class="btn danger" @click="clearStats">{{ $t("stats.reset") }}</button>
      </div>
    </div>

    <div class="card historyCard">
      <div class="row" style="align-items:flex-end">
        <div class="pills">
          <button class="pill" :class="{ active: tab === 'history' }" @click="tab = 'history'">{{ $t("stats.tabs.history") }}</button>
          <button class="pill" :class="{ active: tab === 'decks' }" @click="tab = 'decks'">{{ $t("stats.tabs.decks") }}</button>
          <button class="pill" :class="{ active: tab === 'hard' }" @click="tab = 'hard'">{{ $t("stats.tabs.hard") }}</button>
          <button class="pill" :class="{ active: tab === 'chart' }" @click="tab = 'chart'">{{ $t("stats.tabs.chart") }}</button>
        </div>
        <div v-if="tab === 'history'" class="small" style="opacity:.85">
          {{ $t("stats.entries", { count: attempts.length }) }}
        </div>
        <div v-else-if="tab === 'decks'" class="small">
          <span class="legendSwatch stage-fresh"></span>{{ $t("stats.legend.fresh") }}
          <span class="legendSwatch stage-learning ml-2"></span>{{ $t("stats.legend.learning") }}
          <span class="legendSwatch stage-mastered ml-2"></span>{{ $t("stats.legend.mastered") }}
        </div>
      </div>

      <div class="hr"></div>

      <template v-if="tab === 'decks'">
        <EmptyState v-if="progress.length === 0" :title="$t('stats.noDecks')" :hint="$t('stats.noDecksHint')" />
        <div v-else class="list historyList">
          <div v-for="p in progress" :key="p.deckId" class="card" style="border-radius:18px">
            <div class="row mb-2">
              <h3 class="m-0">{{ decks[p.deckId]?.title ?? p.deckId }}</h3>
              <span class="small">
                {{ $t("stats.freshCount", { count: p.fresh }) }} • {{ $t("stats.learningCount", { count: p.learning }) }} • <b class="text-text">{{ p.mastered }}</b> {{ $t("stats.masteredOf", { total: p.total }) }}
              </span>
            </div>
            <div class="progressBar" role="img" :aria-label="$t('stats.progressAria', { mastered: p.mastered, total: p.total })">
              <span v-if="p.mastered" class="stage-mastered" :style="{ width: pct(p.mastered, p.total) }" :title="$t('stats.masteredCount', { count: p.mastered })"></span>
              <span v-if="p.learning" class="stage-learning" :style="{ width: pct(p.learning, p.total) }" :title="$t('stats.learningCount', { count: p.learning })"></span>
              <span v-if="p.fresh" class="stage-fresh" :style="{ width: pct(p.fresh, p.total) }" :title="$t('stats.freshCount', { count: p.fresh })"></span>
            </div>
          </div>
        </div>
      </template>

      <div v-else-if="tab === 'chart'" class="historyList">
        <ActivityChart :days="activity" />
      </div>

      <template v-else-if="tab === 'hard'">
        <EmptyState v-if="hard.length === 0" :title="$t('stats.noHard')" :hint="$t('stats.noHardHint')" />
        <div v-else class="list historyList">
          <div v-for="h in hard" :key="h.item.id" class="row card" style="border-radius:18px">
            <div>
              <h3 class="m-0">{{ h.item.term }}</h3>
              <p class="small m-0">{{ h.item.definition }} • {{ decks[h.item.deckId]?.title }}</p>
            </div>
            <span class="badge">{{ $t("stats.lapses", { count: h.lapses }) }}</span>
          </div>
        </div>
      </template>

      <div v-else-if="attempts.length === 0">
        <EmptyState :title="$t('stats.noAttempts')" :hint="$t('stats.noAttemptsHint')" />
      </div>

      <!-- ✅ Scroll uniquement ici -->
      <div v-else class="list historyList">
        <div v-for="a in attempts" :key="a.id" class="card" style="border-radius:18px">
          <div class="row">
            <div>
              <h3 style="margin:0">{{ titleFor(a) }}</h3>
              <p class="small" style="margin:4px 0 0 0">
                {{ a.type }} • {{ percent01(a.score) }} • {{ formatDate(a.finishedAt) }}
                <span v-if="metaLine(a)"> • {{ metaLine(a) }}</span>
              </p>
            </div>

            <div class="row" style="gap:8px">
              <router-link
                  class="btn"
                  :to="`/attempt/${a.id}`"
                  :title="canOpenResult(a) ? $t('stats.viewResult') : $t('stats.detailsUnavailable')"
                  :style="!canOpenResult(a) ? 'pointer-events:none; opacity:0.6' : ''"
              >
                {{ $t("stats.result") }}
              </router-link>

              <button
                  class="btn"
                  :title="$t('stats.exportPdf')"
                  @click="exportPdf(a)"
              >
                📄 PDF
              </button>
              <span class="badge" style="opacity:0.6">{{ a.type }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.statsTop {
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(0, 1fr);
  flex: none;
}
@media (min-width: 768px) {
  .statsTop { grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); }
}
.kpiGrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 12px 16px;
}
.kpiCard .kpi { font-size: 1.5rem; }
/* Small screens: the whole page scrolls, the history keeps a usable height. */
@media (max-width: 767px) {
  .statsPage { overflow-y: auto; }
  .historyCard { flex: none; height: 75dvh; }
}
</style>
