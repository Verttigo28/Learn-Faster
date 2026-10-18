<script setup lang="ts">
import { useSessionGuard } from "../composables/useSessionGuard";
import { toast } from "../services/dialog";
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import BaseModal from "../components/BaseModal.vue";
import EmptyState from "../components/EmptyState.vue";
import SentenceOrder from "../components/SentenceOrder.vue";
import {
  ALL_SOURCES,
  buildPractice,
  gradePractice,
  isPracticeCorrect,
  type PracticeQuestion,
  type PracticeSource,
  type VocabDirection
} from "../services/practice";
import { speak, speechSupported } from "../services/speech";
import { db, type AttemptDetail } from "../db";
import { uid } from "../utils/id";
import { clamp01, formatDuration } from "../utils/time";
import { checkAnswer } from "../utils/answer";
import { t } from "../i18n";

const route = useRoute();
const router = useRouter();

const questions = ref<PracticeQuestion[]>([]);
const idx = ref(0);
const locked = ref(false);
const loaded = ref(false);
const typedInput = ref<HTMLInputElement | null>(null);

const startedAt = ref(Date.now());
const now = ref(Date.now());
let timer: number | null = null;

const showModal = ref(false);
const result = ref<{ correct: number; total: number; score: number; breakdown: Record<string, number>; durationSeconds: number } | null>(null);
const savedAttempt = ref(false);

// Option: afficher la traduction FR pendant l'exercice (aide)
const sentenceHelp = ref(false);
function readStorage(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function initHelpFromQuery() {
  const q = String(route.query.sentenceHelp ?? "").trim();
  sentenceHelp.value = q === "1" || q === "true" || readStorage("sentenceHelp") === "1";
}
function persistHelp() {
  try { localStorage.setItem("sentenceHelp", sentenceHelp.value ? "1" : "0"); } catch { /* private mode */ }
}

const tags = computed(() => {
  const raw = String(route.query.tags ?? "").trim();
  return raw ? raw.split(",").map(x => x.trim()).filter(Boolean) : [];
});
const sources = computed<PracticeSource[]>(() => {
  const s = String(route.query.sources ?? "").trim();
  const list = s ? s.split(",").map(x => x.trim()) : ["vocab", "exam", "order"];
  return list.filter((x): x is PracticeSource => (ALL_SOURCES as string[]).includes(x));
});
const vocabDirection = computed<VocabDirection>(() => {
  const d = String(route.query.dir ?? "");
  return d === "reverse" || d === "both" ? d : "forward";
});
const count = computed(() => Number(route.query.count ?? 20) || 20);

const current = computed(() => questions.value[idx.value]);
const isMcq = computed(() => current.value?.kind === "vocab_mcq" || current.value?.kind === "exam_mcq");
const isTyped = computed(() => ["vocab_typed", "cloze", "dictation"].includes(current.value?.kind ?? ""));

const typedCheck = computed(() => {
  const q = current.value;
  if (!q || !locked.value || (q.kind !== "vocab_typed" && q.kind !== "cloze" && q.kind !== "dictation")) return null;
  return checkAnswer(q.answer ?? "", q.expected);
});

const canSubmit = computed(() => {
  const q = current.value;
  if (!q || locked.value) return false;
  if (q.kind === "sentence_order") return (q.answer?.length ?? 0) === q.tokens.length;
  return !!q.answer?.trim();
});
const canProceed = computed(() => locked.value || canSubmit.value);

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

  const wanted = sources.value.filter((s) => s !== "dictation" || speechSupported());
  if (wanted.length < sources.value.length) toast(t("services.speechUnavailable"), "danger");

  questions.value = await buildPractice({
    tags: tags.value,
    count: count.value,
    sources: wanted,
    vocabDirection: vocabDirection.value
  });

  idx.value = 0;
  locked.value = false;
  loaded.value = true;

  if (questions.value.length > 0) {
    timer = window.setInterval(() => {
      now.value = Date.now();
      if (remainingSeconds.value === 0 && !showModal.value) finish();
    }, 250);
  }
}

// Focus the text field and play the dictation when a question appears.
watch(current, async (q) => {
  if (!q) return;
  await nextTick();
  if (q.kind === "dictation" && q.speak) speak(q.speak, q.lang);
  if (isTyped.value) typedInput.value?.focus();
});

function pickAnswer(choiceId: string) {
  if (locked.value || !current.value) return;
  if (current.value.kind === "vocab_mcq" || current.value.kind === "exam_mcq") {
    current.value.answer = choiceId;
  }
}

function submit() {
  if (!canSubmit.value) return;
  locked.value = true;
}

function next() {
  // UX: le bouton "Suivant" valide automatiquement si pas encore validé,
  // puis avance (les utilisateurs s'attendent souvent à "Suivant = valider+suivant").
  if (!current.value) return;

  if (!locked.value) {
    submit();
    if (!locked.value) return; // réponse incomplète
    // Réponse tapée: on laisse voir la correction avant d'avancer.
    if (isTyped.value) return;
  }

  locked.value = false;
  idx.value += 1;
  if (idx.value >= questions.value.length) finish();
}

function plainOptions(opts: { id: string; text: string; correct: boolean }[]) {
  // IMPORTANT: évite de stocker des Proxy Vue dans IndexedDB
  return opts.map(o => ({ id: o.id, text: o.text, correct: !!o.correct }));
}

function toDetail(q: PracticeQuestion): AttemptDetail {
  const ok = isPracticeCorrect(q);
  if (q.kind === "vocab_mcq" || q.kind === "exam_mcq") {
    return {
      kind: q.kind,
      id: q.id,
      prompt: q.prompt,
      options: plainOptions(q.options), // <-- clé: pas de Proxy
      pickedId: q.answer,
      correct: ok,
      explanation: q.kind === "exam_mcq" ? q.explanation : undefined
    };
  }
  if (q.kind === "sentence_order") {
    return {
      kind: "sentence_order",
      id: q.id,
      text: q.text,
      translation: q.translation,
      tokens: [...q.tokens],                       // <-- clé: copie "plain"
      answer: q.answer ? [...q.answer] : undefined, // <-- clé: copie "plain"
      correct: ok
    };
  }
  return {
    kind: q.kind,
    id: q.id,
    prompt: q.kind === "dictation" ? t("services.dictationDetail", { hint: q.hint ?? "" }) : q.prompt,
    expected: q.expected,
    answer: q.answer,
    correct: ok
  };
}

async function finish() {
  if (showModal.value) return;

  stopTimer();

  const g = gradePractice(questions.value);
  const durationSeconds = Math.floor((Date.now() - startedAt.value) / 1000);
  result.value = { ...g, durationSeconds };
  showModal.value = true;

  if (!savedAttempt.value) {
    savedAttempt.value = true;
    try {
      await db.attempts.add({
        id: uid("att"),
        type: "practice",
        refId: "practice",
        startedAt: startedAt.value,
        finishedAt: Date.now(),
        score: clamp01(g.score),
        meta: {
          total: g.total,
          correct: g.correct,
          durationSeconds,
          breakdown: g.breakdown,
          tags: [...tags.value],
          details: questions.value.map(toDetail)
        }
      });
    } catch (e) {
      console.error(e);
      savedAttempt.value = false;
      toast(t("common.saveError"), "danger");
    }
  }
}

function percent(x: number) {
  return `${Math.round(x * 100)}%`;
}

const BREAKDOWN_KEYS = ["vocab", "exam", "order", "typed", "cloze", "dictation"];
function breakdownLabel(k: string): string {
  return BREAKDOWN_KEYS.includes(k) ? t(`practice.breakdown.${k}`) : k;
}

function onKeydown(e: KeyboardEvent) {
  if (showModal.value || !current.value) return;
  if (e.key === "Enter") {
    e.preventDefault();
    next();
    return;
  }
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  if (isMcq.value && /^[1-9]$/.test(e.key)) {
    const q = current.value;
    if (q.kind !== "vocab_mcq" && q.kind !== "exam_mcq") return;
    const opt = q.options[Number(e.key) - 1];
    if (opt) pickAnswer(opt.id);
  }
}

async function goHome() { await router.push("/"); }
async function goStats() { await router.push("/stats"); }
async function goGenerator() { await router.push("/exams"); }

useSessionGuard(() => !showModal.value && questions.value.length > 0 && (idx.value > 0 || locked.value));

onMounted(() => {
  window.addEventListener("keydown", onKeydown);
  load();
});
onUnmounted(() => {
  stopTimer();
  window.removeEventListener("keydown", onKeydown);
});
</script>

<template>
  <div class="sessionPage">
    <div v-if="!loaded" class="card sessionCard"></div>

    <div v-else-if="questions.length === 0" class="card sessionCard">
      <EmptyState
        :title="$t('practice.emptyTitle')"
        :hint="$t('practice.emptyHint')"
      />
      <div class="row mt-3">
        <router-link class="btn" to="/exams">{{ $t("practice.backGenerator") }}</router-link>
        <router-link class="btn" to="/import">{{ $t("practice.import") }}</router-link>
        <router-link class="btn" to="/sentences">{{ $t("practice.addSentences") }}</router-link>
      </div>
    </div>

    <div v-else-if="current" class="sessionCard">
      <div class="row">
        <div>
          <h2 class="m-0">{{ $t("practice.title") }}</h2>
          <p class="small mt-1">
            {{ $t("practice.progress", { n: idx + 1, total: questions.length }) }}
            <span v-if="tags.length"> • {{ $t("practice.tags", { tags: tags.join(", ") }) }}</span>
          </p>
        </div>

        <div class="row">
          <span v-if="remainingSeconds !== null" class="badge">⏱ {{ formatDuration(remainingSeconds) }}</span>
          <button class="btn" @click="goGenerator">{{ $t("common.quit") }}</button>
        </div>
      </div>

      <div class="hr"></div>

      <!-- ✅ Scroll uniquement dans cette zone -->
      <div class="sessionBody">
        <div v-if="current.kind === 'vocab_mcq' || current.kind === 'exam_mcq'">
          <h3 class="mt-0">{{ current.prompt }}</h3>

          <div class="list">
            <button
              v-for="(o, i) in current.options"
              :key="o.id"
              class="btn justify-start text-left"
              :class="{
                primary: current.answer === o.id && !locked,
                ok: locked && o.correct,
                danger: locked && current.answer === o.id && !o.correct
              }"
              @click="pickAnswer(o.id)"
            >
              <span class="small">{{ i + 1 }}</span> {{ o.text }}
            </button>
          </div>

          <p v-if="locked && current.kind === 'exam_mcq' && current.explanation" class="small mt-2.5">
            💡 {{ current.explanation }}
          </p>
        </div>

        <div v-else-if="current.kind === 'sentence_order'">
          <h3 class="mt-0">{{ $t("practice.orderTitle") }}</h3>

          <div class="row justify-start gap-2.5 mb-2.5">
            <label class="badge cursor-pointer">
              <input type="checkbox" v-model="sentenceHelp" @change="persistHelp" />
              {{ $t("common.translationHelp") }}
            </label>
            <span v-if="sentenceHelp && current.translation" class="small">🇫🇷 {{ current.translation }}</span>
          </div>

          <SentenceOrder :tokens="current.tokens" v-model="current.answer" />

          <div v-if="locked" class="card mt-3 rounded-[18px]">
            <div class="row">
              <span class="badge" :class="isPracticeCorrect(current) ? 'border-ok/60' : 'border-danger/60'">
                {{ isPracticeCorrect(current) ? $t("practice.correct") : $t("practice.incorrect") }}
              </span>
              <span class="small">{{ $t("practice.correctSentence") }}</span>
            </div>
            <h3 class="mt-2.5 mb-0">{{ current.text }}</h3>
            <p v-if="current.translation" class="small mt-1.5 mb-0">🇫🇷 {{ current.translation }}</p>
          </div>
        </div>

        <div v-else>
          <template v-if="current.kind === 'dictation'">
            <h3 class="mt-0">{{ current.prompt }}</h3>
            <button class="btn primary" type="button" @click="speak(current.speak ?? '', current.lang)">{{ $t("practice.replay") }}</button>
          </template>
          <template v-else-if="current.kind === 'cloze'">
            <h3 class="mt-0">{{ $t("practice.clozeTitle") }}</h3>
            <p class="text-xl font-bold text-text">{{ current.prompt }}</p>
            <p v-if="sentenceHelp && current.hint" class="small">🇫🇷 {{ current.hint }}</p>
            <label class="badge cursor-pointer">
              <input type="checkbox" v-model="sentenceHelp" @change="persistHelp" />
              {{ $t("common.translationHelp") }}
            </label>
          </template>
          <h3 v-else class="mt-0">{{ current.prompt }}</h3>

          <input
            ref="typedInput"
            v-model="current.answer"
            class="input mt-3 text-lg"
            :disabled="locked"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            :placeholder="$t('practice.placeholder')"
          />

          <div v-if="locked && typedCheck" class="card mt-3 rounded-[18px]">
            <span class="badge" :class="typedCheck.correct ? 'border-ok/60' : 'border-danger/60'">
              {{ typedCheck.correct ? (typedCheck.typo ? $t("practice.almost") : $t("practice.correct")) : $t("practice.incorrect") }}
            </span>
            <p class="mt-2.5 mb-0">{{ $t("practice.expected") }} <b class="text-text">{{ current.expected }}</b></p>
            <p v-if="current.kind === 'dictation' && current.hint" class="small">{{ $t("practice.meaning", { hint: current.hint }) }}</p>
          </div>
        </div>
      </div>

      <div class="sessionFooter">
        <div class="row mt-3">
          <button class="btn" @click="submit" :disabled="!canSubmit">{{ $t("common.submit") }}</button>
          <button class="btn" @click="next" :disabled="!canProceed">{{ $t("common.next") }}</button>
          <button class="btn ok" @click="finish">{{ $t("common.finish") }}</button>
        </div>

        <p class="small mt-2.5">
          {{ $t("practice.shortcuts") }}
        </p>
      </div>
    </div>

    <BaseModal :open="showModal" :title="$t('practice.resultTitle')" @close="goHome">
      <div v-if="result" class="card" style="margin:0">
        <div class="row">
          <div>
            <div class="small">{{ $t("common.score") }}</div>
            <div class="kpi">{{ percent(result.score) }}</div>
          </div>
          <div>
            <div class="small">{{ $t("common.correctAnswers") }}</div>
            <div class="kpi">{{ result.correct }}/{{ result.total }}</div>
          </div>
          <div>
            <div class="small">{{ $t("common.duration") }}</div>
            <div class="kpi">{{ formatDuration(result.durationSeconds) }}</div>
          </div>
        </div>

        <div class="hr"></div>

        <div class="row justify-start">
          <template v-for="(n, k) in result.breakdown" :key="k">
            <span v-if="n" class="badge">{{ breakdownLabel(k) }}: {{ n }}</span>
          </template>
        </div>

        <div class="hr"></div>

        <div class="row">
          <button class="btn" @click="goStats">{{ $t("common.viewStats") }}</button>
          <button class="btn" @click="goGenerator">{{ $t("practice.newFilter") }}</button>
          <button class="btn ok" @click="goHome">{{ $t("practice.backHome") }}</button>
        </div>

        <p class="small mt-2.5">
          {{ $t("practice.savedNote") }}
        </p>
      </div>
    </BaseModal>
  </div>
</template>
