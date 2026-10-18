<script setup lang="ts">
import { useSessionGuard } from "../composables/useSessionGuard";
import { toast } from "../services/dialog";
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { db, type Exam, type ExamQuestion, type AttemptDetail } from "../db";
import EmptyState from "../components/EmptyState.vue";
import BaseModal from "../components/BaseModal.vue";
import { uid } from "../utils/id";
import { clamp01, formatDuration } from "../utils/time";
import { shuffle } from "../utils/shuffle";
import { t } from "../i18n";

const props = defineProps<{ examId?: string }>();

const route = useRoute();
const router = useRouter();
const examId = computed(() => props.examId ?? String(route.params.examId));
const exam = ref<Exam | null>(null);
const questions = ref<ExamQuestion[]>([]);
const idx = ref(0);

const selected = ref<Record<string, string>>({});
const finished = ref(false);
const savedAttempt = ref(false);

const startedAt = ref(Date.now());
const now = ref(Date.now());
let timer: number | null = null;

const showResultModal = ref(false);
const lastResult = ref<{ correct: number; total: number; score: number; durationSeconds: number } | null>(null);

const remainingSeconds = computed(() => {
  if (!exam.value?.durationSeconds) return null;
  const elapsed = Math.floor((now.value - startedAt.value) / 1000);
  return Math.max(0, exam.value.durationSeconds - elapsed);
});

function percent(score01: number) {
  return `${Math.round(score01 * 100)}%`;
}

function stopTimer() {
  if (timer) {
    window.clearInterval(timer);
    timer = null;
  }
}

async function load() {
  exam.value = (await db.exams.get(examId.value)) ?? null;
  questions.value = await db.examQuestions.where("examId").equals(examId.value).toArray();
  // Mélange l'ordre des questions + l'ordre des choix (plus "aléatoire" à l'usage)
  questions.value = shuffle(questions.value).map((q) => ({
    ...q,
    choices: shuffle(q.choices)
  }));

  idx.value = 0;
  selected.value = {};
  finished.value = false;
  savedAttempt.value = false;
  showResultModal.value = false;
  lastResult.value = null;

  startTimer();
}

function startTimer() {
  startedAt.value = Date.now();
  now.value = Date.now();

  stopTimer();
  timer = window.setInterval(() => {
    now.value = Date.now();
    if (remainingSeconds.value === 0 && !finished.value) finish();
  }, 250);
}

function isWrong(q: ExamQuestion): boolean {
  const picked = selected.value[q.id];
  return q.choices.find((c) => c.id === picked)?.correct !== true;
}

/** Wrong (or unanswered) questions, once the exam is finished. */
const mistakeCount = computed(() => (finished.value ? questions.value.filter(isWrong).length : 0));
const answeredCount = computed(() => Object.keys(selected.value).length);
const progressPct = computed(() => (questions.value.length ? (answeredCount.value / questions.value.length) * 100 : 0));

/** Restart with only the questions answered wrong (choices reshuffled, timer restarted). */
function retryMistakes() {
  const wrong = questions.value.filter(isWrong);
  if (!wrong.length) return;
  for (const q of wrong) q.choices = shuffle(q.choices);
  questions.value = wrong;
  idx.value = 0;
  selected.value = {};
  finished.value = false;
  savedAttempt.value = false;
  showResultModal.value = false;
  lastResult.value = null;
  startTimer();
}

function choose(choiceId: string) {
  if (finished.value) return;
  if (!current.value) return;
  selected.value[current.value.id] = choiceId;
}

const current = computed(() => questions.value[idx.value]);

function next() {
  if (idx.value < questions.value.length - 1) idx.value += 1;
}

function prev() {
  if (idx.value > 0) idx.value -= 1;
}

function computeScore() {
  let correct = 0;
  for (const q of questions.value) {
    const picked = selected.value[q.id];
    const isCorrect = q.choices.find((c) => c.id === picked)?.correct === true;
    if (isCorrect) correct += 1;
  }
  const total = questions.value.length;
  const score = total ? correct / total : 0;
  return { correct, total, score };
}

function plainOptions(opts: { id: string; text: string; correct: boolean }[]) {
  // IMPORTANT: retourne des objets "plain" (pas de Proxy Vue) => clonables par IndexedDB
  return opts.map(o => ({ id: o.id, text: o.text, correct: !!o.correct }));
}


async function finish() {
  if (finished.value) return;

  finished.value = true;
  stopTimer(); // stop timer on finish ✅

  const { correct, total, score } = computeScore();
  const durationSeconds = Math.floor((Date.now() - startedAt.value) / 1000);

  lastResult.value = { correct, total, score, durationSeconds };
  showResultModal.value = true;

  // ✅ Sauvegarde une seule fois
  if (savedAttempt.value) return;
  savedAttempt.value = true;

  // Détails "plain" (pas de Proxy) pour IndexedDB + PDF + page Résultat
  const details: AttemptDetail[] = questions.value.map((q) => {
    const pickedId = selected.value[q.id];
    const ok = q.choices.some((c) => c.id === pickedId && c.correct);
    return {
      kind: "exam_mcq",
      id: q.id,
      prompt: q.prompt,
      options: plainOptions(q.choices),
      pickedId,
      correct: ok,
      explanation: q.explanation
    };
  });

  try {
    await db.attempts.add({
      id: uid("att"),
      type: "exam",
      refId: examId.value,
      startedAt: startedAt.value,
      finishedAt: Date.now(),
      score: clamp01(score),
      meta: { total, correct, durationSeconds, details }
    });
  } catch (e) {
    console.error(e);
    savedAttempt.value = false; // permet de retenter si besoin
    toast(t("common.saveError"), "danger");
  }
}

function closeModal() {
  showResultModal.value = false;
}
async function goBack() {
  await router.push("/");
}
async function goStats() {
  await router.push("/stats");
}

function onKeydown(e: KeyboardEvent) {
  if (showResultModal.value || !current.value) return;
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  if (e.key === "ArrowRight") next();
  else if (e.key === "ArrowLeft") prev();
  else if (/^[1-9]$/.test(e.key)) {
    const c = current.value.choices[Number(e.key) - 1];
    if (c) choose(c.id);
  }
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => {
  stopTimer();
  window.removeEventListener("keydown", onKeydown);
});
useSessionGuard(() => !finished.value && Object.keys(selected.value).length > 0);

onMounted(load);
</script>

<template>
  <div class="sessionPage">
    <div v-if="!exam" class="card sessionCard">
      <EmptyState :title="$t('examRun.notFound')" />
    </div>

    <div v-else-if="questions.length === 0" class="card sessionCard">
      <EmptyState :title="$t('examRun.emptyTitle')" :hint="$t('examRun.emptyHint')" />
    </div>

    <div v-else class="sessionCard">
      <div class="row">
        <div>
          <h2 class="m-0">{{ exam.title }}</h2>
          <p class="small mt-1">{{ $t("examRun.progress", { n: idx + 1, total: questions.length }) }}</p>
        </div>

        <div class="row">
          <span v-if="remainingSeconds !== null" class="badge">⏱ {{ formatDuration(remainingSeconds) }}</span>
          <router-link class="btn" to="/">{{ $t("common.quit") }}</router-link>
        </div>
      </div>

      <div
        class="meter mt-2"
        role="progressbar"
        :aria-label="$t('examRun.progressAria')"
        :aria-valuenow="Math.round(progressPct)"
        aria-valuemin="0"
        aria-valuemax="100"
      ><span :style="{ width: `${progressPct}%` }"></span></div>

      <div class="hr"></div>

      <!-- ✅ Scroll uniquement dans cette zone -->
      <div class="sessionBody">
        <div class="card rounded-[18px]">
          <h3 class="sessionPrompt">{{ current.prompt }}</h3>

          <div class="list">
            <button
              v-for="(c, i) in current.choices"
              :key="c.id"
              class="btn justify-start text-left"
              :class="{
                primary: selected[current.id] === c.id && !finished,
                ok: finished && c.correct,
                danger: finished && selected[current.id] === c.id && !c.correct
              }"
              @click="choose(c.id)"
            >
              <span class="small">{{ i + 1 }}</span> {{ c.text }}
            </button>
          </div>

          <p v-if="finished && current.explanation" class="small mt-2.5">
            💡 {{ current.explanation }}
          </p>
        </div>
      </div>

      <div class="sessionFooter">
        <div class="row mt-3">
          <button class="btn" @click="prev" :disabled="idx === 0">← {{ $t("common.previous") }}</button>
          <button class="btn" @click="next" :disabled="idx === questions.length - 1">{{ $t("common.next") }} →</button>
          <button class="btn ok" @click="finish" :disabled="finished">{{ $t("common.finish") }}</button>
          <button v-if="mistakeCount" class="btn primary" @click="retryMistakes">{{ $t("examRun.retryMistakes", { count: mistakeCount }) }}</button>
        </div>

        <p class="small mt-2.5">
          {{ $t("examRun.answered", { answered: answeredCount, total: questions.length }) }}
        </p>
      </div>
    </div>

    <BaseModal :open="showResultModal" :title="$t('examRun.resultTitle')" @close="closeModal">
      <div v-if="lastResult" class="card" style="margin:0">
        <div class="row">
          <div>
            <div class="small">{{ $t("common.score") }}</div>
            <div class="kpi">{{ percent(lastResult.score) }}</div>
          </div>
          <div>
            <div class="small">{{ $t("common.correctAnswers") }}</div>
            <div class="kpi">{{ lastResult.correct }}/{{ lastResult.total }}</div>
          </div>
          <div>
            <div class="small">{{ $t("common.duration") }}</div>
            <div class="kpi">{{ formatDuration(lastResult.durationSeconds) }}</div>
          </div>
        </div>

        <div class="hr"></div>

        <div class="row">
          <button v-if="mistakeCount" class="btn primary" @click="retryMistakes">{{ $t("examRun.retryMistakes", { count: mistakeCount }) }}</button>
          <button class="btn" @click="goStats">{{ $t("common.viewStats") }}</button>
          <button class="btn" @click="goBack">{{ $t("examRun.backHome") }}</button>
          <button class="btn ok" @click="closeModal">{{ $t("examRun.review") }}</button>
        </div>

        <p class="small mt-2.5">
          {{ $t("examRun.reviewNote") }}
        </p>
      </div>
    </BaseModal>
  </div>
</template>
