<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { db, type Exam, type ExamQuestion, type AttemptDetail } from "../db";
import EmptyState from "../components/EmptyState.vue";
import BaseModal from "../components/BaseModal.vue";
import { uid } from "../utils/id";
import { clamp01, formatDuration } from "../utils/time";
import { shuffle } from "../utils/shuffle";

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

  startedAt.value = Date.now();
  now.value = Date.now();

  stopTimer();
  timer = window.setInterval(() => {
    now.value = Date.now();
    if (remainingSeconds.value === 0 && !finished.value) finish();
  }, 250);
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
    alert("Erreur lors de l'enregistrement des résultats (IndexedDB).");
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

onUnmounted(() => stopTimer());
onMounted(load);
</script>

<template>
  <div v-if="!exam">
    <EmptyState title="Exam introuvable" />
  </div>

  <div v-else-if="questions.length === 0">
    <EmptyState title="Exam vide" hint="Importe des questions dans cet exam." />
  </div>

  <div v-else class="card">
    <div class="row">
      <div>
        <h2 style="margin:0">{{ exam.title }}</h2>
        <p class="small" style="margin:4px 0 0 0">Question {{ idx + 1 }} / {{ questions.length }}</p>
      </div>

      <div class="row">
        <span v-if="remainingSeconds !== null" class="badge">
          ⏱ {{ formatDuration(remainingSeconds) }}
        </span>
        <router-link class="btn" to="/">Quitter</router-link>
      </div>
    </div>

    <div class="hr"></div>

    <div class="card" style="border-radius: 18px">
      <h3 style="margin-top:0">{{ current.prompt }}</h3>

      <div class="list">
        <button
          v-for="c in current.choices"
          :key="c.id"
          class="btn"
          :class="{
            primary: selected[current.id] === c.id && !finished,
            ok: finished && c.correct,
            danger: finished && selected[current.id] === c.id && !c.correct
          }"
          style="text-align:left"
          @click="choose(c.id)"
        >
          {{ c.text }}
        </button>
      </div>

      <p v-if="finished && current.explanation" class="small" style="margin-top:10px">
        💡 {{ current.explanation }}
      </p>
    </div>

    <div class="row" style="margin-top:12px">
      <button class="btn" @click="prev" :disabled="idx === 0">← Précédent</button>
      <button class="btn" @click="next" :disabled="idx === questions.length - 1">Suivant →</button>
      <button class="btn ok" @click="finish" :disabled="finished">Terminer</button>
    </div>

    <p class="small" style="margin-top:10px">
      Réponses: {{ Object.keys(selected).length }} / {{ questions.length }}
    </p>
  </div>

  <BaseModal :open="showResultModal" title="Résultat de l'exam" @close="closeModal">
    <div v-if="lastResult" class="card" style="margin:0">
      <div class="row">
        <div>
          <div class="small">Score</div>
          <div class="kpi">{{ percent(lastResult.score) }}</div>
        </div>
        <div>
          <div class="small">Bonnes réponses</div>
          <div class="kpi">{{ lastResult.correct }}/{{ lastResult.total }}</div>
        </div>
        <div>
          <div class="small">Durée</div>
          <div class="kpi">{{ formatDuration(lastResult.durationSeconds) }}</div>
        </div>
      </div>

      <div class="hr"></div>

      <div class="row">
        <button class="btn" @click="goStats">Voir les stats</button>
        <button class="btn" @click="goBack">Retour accueil</button>
        <button class="btn ok" @click="closeModal">Revoir les corrections</button>
      </div>

      <p class="small" style="margin-top:10px">
        Les corrections restent affichées dans l’exam (bonnes réponses en vert).
      </p>
    </div>
  </BaseModal>
</template>
