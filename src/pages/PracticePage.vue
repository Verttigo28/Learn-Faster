<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import BaseModal from "../components/BaseModal.vue";
import ConfirmModal from "../components/ConfirmModal.vue";
import EmptyState from "../components/EmptyState.vue";
import SentenceOrder from "../components/SentenceOrder.vue";
import ProgressBar from "../components/ProgressBar.vue";
import { buildPractice, gradePractice, type PracticeQuestion } from "../services/practice";
import { db, type AttemptDetail } from "../db";
import { uid } from "../utils/id";
import { clamp01, formatDuration } from "../utils/time";
import { plainOptions, copyStrings } from "../utils/reactive";
import { useToast } from "../composables/useToast";
import { recordReview } from "../services/srs";

const toast = useToast();

const route = useRoute();
const router = useRouter();

const questions = ref<PracticeQuestion[]>([]);
const idx = ref(0);
const locked = ref(false);

const startedAt = ref(Date.now());
const now = ref(Date.now());
let timer: number | null = null;

const showModal = ref(false);
const showFinishConfirm = ref(false);
const result = ref<{ correct: number; total: number; score: number; breakdown: Record<string, number>; durationSeconds: number } | null>(null);
const savedAttempt = ref(false);

// Option: afficher la traduction FR pendant l'exercice (aide)
const sentenceHelp = ref(false);
function initHelpFromQuery() {
  const q = String(route.query.sentenceHelp ?? "").trim();
  const fromQuery = q === "1" || q === "true";
  const fromStorage = localStorage.getItem("sentenceHelp") === "1";
  sentenceHelp.value = fromQuery || fromStorage;
}
function persistHelp() {
  localStorage.setItem("sentenceHelp", sentenceHelp.value ? "1" : "0");
}

const tags = computed(() => {
  const t = String(route.query.tags ?? "").trim();
  return t ? t.split(",").map(x => x.trim()).filter(Boolean) : [];
});
const sources = computed(() => {
  const s = String(route.query.sources ?? "").trim();
  return s ? s.split(",").map(x => x.trim()).filter(Boolean) : ["vocab", "exam", "order"];
});
const count = computed(() => Number(route.query.count ?? 20) || 20);

const current = computed(() => questions.value[idx.value]);

const canProceed = computed(() => {
  if (!current.value) return false;
  if (locked.value) return true;
  if (current.value.kind === "vocab_mcq" || current.value.kind === "exam_mcq") {
    return !!current.value.answer;
  }
  // sentence_order
  return (current.value.answer?.length ?? 0) === current.value.tokens.length;
});

// simple timer: 45 sec/question
const remainingSeconds = computed(() => {
  const total = questions.value.length;
  if (!total) return null;
  const budget = total * 45;
  const elapsed = Math.floor((now.value - startedAt.value) / 1000);
  return Math.max(0, budget - elapsed);
});

function stopTimer() {
  if (timer) {
    window.clearInterval(timer);
    timer = null;
  }
}

async function load() {
  initHelpFromQuery();
  startedAt.value = Date.now();
  now.value = Date.now();
  stopTimer();

  timer = window.setInterval(() => {
    now.value = Date.now();
    if (remainingSeconds.value === 0 && !showModal.value) finish();
  }, 250);

  questions.value = await buildPractice({
    tags: tags.value,
    count: count.value,
    sources: sources.value as any
  });

  idx.value = 0;
  locked.value = false;

  if (questions.value.length === 0) stopTimer();
}

function pickAnswer(choiceId: string) {
  if (locked.value) return;
  if (!current.value) return;
  if (current.value.kind === "vocab_mcq" || current.value.kind === "exam_mcq") {
    current.value.answer = choiceId;
  }
}

function submit() {
  if (!current.value) return;

  if (current.value.kind === "vocab_mcq" || current.value.kind === "exam_mcq") {
    if (!current.value.answer) return;
    locked.value = true;
    return;
  }

  if (current.value.kind === "sentence_order") {
    if (!current.value.answer || current.value.answer.length !== current.value.tokens.length) return;
    locked.value = true;
  }
}

async function next() {
  // UX: le bouton "Suivant" valide automatiquement si pas encore validé,
  // puis avance (les utilisateurs s'attendent souvent à "Suivant = valider+suivant").
  if (!current.value) return;

  if (!locked.value) {
    submit();
    if (!locked.value) return; // réponse incomplète
  }

  // SRS: record the review result for this question
  const q = current.value;
  const correct = isCorrect(q);
  const srsType = q.kind === "vocab_mcq" ? "vocab" : q.kind === "exam_mcq" ? "exam" : "sentence";
  await recordReview(q.id, srsType, correct ? 4 : 1).catch(() => {});

  locked.value = false;
  idx.value += 1;
  if (idx.value >= questions.value.length) finish();
}

function isCorrect(q: PracticeQuestion): boolean {
  if (q.kind === "vocab_mcq" || q.kind === "exam_mcq") {
    const picked = q.answer;
    return q.options.find(o => o.id === picked)?.correct === true;
  }
  const user = q.answer ?? [];
  return user.length === q.tokens.length && user.every((t, i) => t === q.tokens[i]);
}

// plainOptions & copyStrings imported from utils/reactive


async function finish() {
  if (showModal.value) return;

  stopTimer();

  const g = gradePractice(questions.value);
  const durationSeconds = Math.floor((Date.now() - startedAt.value) / 1000);
  result.value = { ...g, durationSeconds };
  showModal.value = true;

  if (!savedAttempt.value) {
    savedAttempt.value = true;

    const details: AttemptDetail[] = questions.value.map((q) => {
      if (q.kind === "vocab_mcq" || q.kind === "exam_mcq") {
        const pickedId = q.answer;
        const ok = q.options.some((o) => o.id === pickedId && o.correct);
        return {
          kind: q.kind,
          id: q.id,
          prompt: q.prompt,
          options: plainOptions(q.options), // <-- clé: pas de Proxy
          pickedId,
          correct: ok,
          explanation: q.kind === "exam_mcq" ? q.explanation : undefined
        };
      }

      const user = q.answer ?? [];
      const ok = user.length === q.tokens.length && user.every((t, i) => t === q.tokens[i]);

      return {
        kind: "sentence_order",
        id: q.id,
        text: q.text,
        translation: q.translation,
        tokens: [...q.tokens],              // <-- clé: copie "plain"
        answer: copyStrings(q.answer),      // <-- clé: copie "plain"
        correct: ok
      };
    });

    try {
      await db.attempts.add({
        id: uid("att"),
        type: "practice",
        refId: "practice",
        startedAt: startedAt.value,
        finishedAt: Date.now(),
        score: clamp01(g.score),
        meta: { total: g.total, correct: g.correct, durationSeconds, breakdown: g.breakdown, tags: tags.value, details }
      });
    } catch (e) {
      console.error(e);
      savedAttempt.value = false;
      toast.error("Erreur lors de l'enregistrement des résultats.");
    }
  }
}

function percent(x: number) {
  return `${Math.round(x * 100)}%`;
}

async function goHome() { await router.push("/"); }
async function goStats() { await router.push("/stats"); }
async function goGenerator() { await router.push("/exams"); }

async function restart() {
  showModal.value = false;
  result.value = null;
  savedAttempt.value = false;
  await load();
}

onMounted(load);
</script>

<template>
  <div class="sessionPage">
    <div v-if="questions.length === 0" class="card sessionCard">
      <EmptyState
        title="Rien à réviser"
        hint="Aucune question ne correspond aux filtres. Ajoute du contenu ou change les tags."
        icon="🔍"
      />
      <div class="row mt-3">
        <router-link class="btn" to="/exams">Retour générateur</router-link>
        <router-link class="btn" to="/import">Importer</router-link>
        <router-link class="btn" to="/sentences">Ajouter des phrases</router-link>
      </div>
    </div>

    <div v-else class="sessionCard">
      <div class="row">
        <div>
          <h2 class="m-0">Exam (tags)</h2>
          <p class="small mt-1">
            Question {{ idx + 1 }} / {{ questions.length }}
            <span v-if="tags.length"> • Tags: {{ tags.join(", ") }}</span>
          </p>
        </div>

        <div class="row">
          <span v-if="remainingSeconds !== null" class="badge">⏱ {{ formatDuration(remainingSeconds) }}</span>
          <button class="btn" @click="goGenerator">Quitter</button>
        </div>
      </div>

      <ProgressBar :current="idx + 1" :total="questions.length" />

      <!-- ✅ Scroll uniquement dans cette zone -->
      <div class="sessionBody mt-3">
        <div v-if="current.kind === 'vocab_mcq' || current.kind === 'exam_mcq'">
          <h3 class="mt-0">{{ current.prompt }}</h3>

          <div class="list">
            <button
              v-for="o in current.options"
              :key="o.id"
              class="btn justify-start text-left"
              :class="{
                primary: current.answer === o.id && !locked,
                ok: locked && o.correct,
                danger: locked && current.answer === o.id && !o.correct
              }"
              @click="pickAnswer(o.id)"
            >
              {{ o.text }}
            </button>
          </div>

          <p v-if="locked && current.kind === 'exam_mcq' && current.explanation" class="small mt-2.5">
            💡 {{ current.explanation }}
          </p>
        </div>

        <div v-else-if="current.kind === 'sentence_order'">
          <h3 class="mt-0">Remets la phrase dans le bon ordre</h3>

          <div class="row justify-start gap-2.5 mb-2.5">
            <label class="badge cursor-pointer">
              <input type="checkbox" v-model="sentenceHelp" @change="persistHelp" />
              Aide : afficher la traduction
            </label>
            <span v-if="sentenceHelp && current.translation" class="small">🇫🇷 {{ current.translation }}</span>
          </div>

          <SentenceOrder :tokens="current.tokens" v-model="current.answer" />

          <div v-if="locked" class="card mt-3 rounded-[18px]">
            <div class="row">
              <span
                class="badge"
                :style="isCorrect(current) ? 'border-color: rgba(61,220,151,.65)' : 'border-color: rgba(255,107,107,.65)'"
              >
                {{ isCorrect(current) ? '✅ Correct' : '❌ Incorrect' }}
              </span>
              <span class="small">Phrase correcte :</span>
            </div>
            <h3 class="mt-2.5 mb-0">{{ current.text }}</h3>
            <p v-if="current.translation" class="small mt-1.5 mb-0">🇫🇷 {{ current.translation }}</p>
          </div>
        </div>
      </div>

      <div class="sessionFooter">
        <div class="row mt-3">
          <button class="btn" @click="submit" :disabled="locked || (current.kind !== 'sentence_order' && !current.answer)">
            Valider
          </button>
          <button class="btn" @click="next" :disabled="!canProceed">Suivant</button>
          <button class="btn ok" @click="showFinishConfirm = true">Terminer</button>
        </div>

        <p class="small mt-2.5">
          Pour l’ordre des mots : clique un mot pour l’ajouter, puis clique-le dans "Ta réponse" pour l’enlever.
        </p>
      </div>
    </div>

    <ConfirmModal
      :open="showFinishConfirm"
      title="Terminer la session ?"
      message="Tu n'as pas fini toutes les questions. Terminer maintenant ?"
      confirm-text="Terminer"
      @confirm="showFinishConfirm = false; finish()"
      @cancel="showFinishConfirm = false"
    />

    <BaseModal :open="showModal" title="Résultat (exam tags)" @close="goHome">
      <div v-if="result" class="card" style="margin:0">
        <div class="row">
          <div>
            <div class="small">Score</div>
            <div class="kpi">{{ percent(result.score) }}</div>
          </div>
          <div>
            <div class="small">Bonnes réponses</div>
            <div class="kpi">{{ result.correct }}/{{ result.total }}</div>
          </div>
          <div>
            <div class="small">Durée</div>
            <div class="kpi">{{ formatDuration(result.durationSeconds) }}</div>
          </div>
        </div>

        <div class="hr"></div>

        <div class="row">
          <span class="badge">Vocab: {{ result.breakdown.vocab ?? 0 }}</span>
          <span class="badge">QCM: {{ result.breakdown.exam ?? 0 }}</span>
          <span class="badge">SPOK: {{ result.breakdown.order ?? 0 }}</span>
        </div>

        <div class="hr"></div>

        <div class="row">
          <button class="btn primary" @click="restart">🔄 Recommencer</button>
          <button class="btn" @click="goStats">Voir les stats</button>
          <button class="btn" @click="goGenerator">Nouveau filtre</button>
          <button class="btn ok" @click="goHome">Retour accueil</button>
        </div>

        <p class="small mt-2.5">
          Cette session est sauvegardée dans Stats (type: practice).
        </p>
      </div>
    </BaseModal>
  </div>
</template>
