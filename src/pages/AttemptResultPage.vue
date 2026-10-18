<script setup lang="ts">
import { toast } from "../services/dialog";
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import EmptyState from "../components/EmptyState.vue";
import { db, isTypedDetail, type Attempt, type AttemptDetail, type Exam, type VocabDeck } from "../db";
import { exportAttemptPdf } from "../services/pdfReport";
import { formatDate, formatDuration } from "../utils/time";
import { t } from "../i18n";

const props = defineProps<{ attemptId?: string }>();
const route = useRoute();
const router = useRouter();

const attemptId = computed(() => props.attemptId ?? String(route.params.attemptId));

const attempt = ref<Attempt | null>(null);
const exam = ref<Exam | null>(null);
const deck = ref<VocabDeck | null>(null);

const showOnlyWrong = ref(false);

const title = computed(() => {
  if (!attempt.value) return t("attempt.result");
  if (attempt.value.type === "exam") return exam.value?.title ?? t("attempt.examFallback", { id: attempt.value.refId });
  if (attempt.value.type === "vocab_quiz") return deck.value?.title ?? t("attempt.deckFallback", { id: attempt.value.refId });
  if (attempt.value.type === "practice") return t("attempt.practiceTitle");
  if (attempt.value.type === "flashcards" && attempt.value.refId === "review") return t("attempt.reviewTitle");
  if (attempt.value.type === "flashcards") return deck.value?.title ?? t("attempt.flashcardsFallback", { id: attempt.value.refId });
  return t("attempt.result");
});

const details = computed<AttemptDetail[]>(() => attempt.value?.meta?.details ?? []);

const filtered = computed(() => {
  if (!showOnlyWrong.value) return details.value;
  return details.value.filter((d) => !d.correct);
});

function percent01(x: number) {
  return `${Math.round(x * 100)}%`;
}

function pickedText(d: Extract<AttemptDetail, { kind: "vocab_mcq" | "exam_mcq" }>) {
  return d.options.find((o) => o.id === d.pickedId)?.text ?? t("common.none");
}
function correctText(d: Extract<AttemptDetail, { kind: "vocab_mcq" | "exam_mcq" }>) {
  return d.options.find((o) => o.correct)?.text ?? `(${t("common.unknown")})`;
}

function answerSentence(d: Extract<AttemptDetail, { kind: "sentence_order" }>) {
  return (d.answer ?? []).join(" ") || t("common.empty");
}
function correctionSentence(d: Extract<AttemptDetail, { kind: "sentence_order" }>) {
  return (d.tokens ?? []).join(" ");
}

function canExportPdf(a: Attempt | null): boolean {
  return !!a && !!a.meta?.details?.length;
}

async function exportPdf() {
  if (!attempt.value) return;
  try {
    await exportAttemptPdf(attempt.value, title.value);
  } catch (e) {
    toast(e instanceof Error ? e.message : t("services.pdfError"), "danger");
  }
}

async function load() {
  attempt.value = (await db.attempts.get(attemptId.value)) ?? null;
  exam.value = null;
  deck.value = null;

  if (attempt.value?.type === "exam") {
    exam.value = (await db.exams.get(attempt.value.refId)) ?? null;
  }
  if (attempt.value?.type === "vocab_quiz" || attempt.value?.type === "flashcards") {
    deck.value = (await db.vocabDecks.get(attempt.value.refId)) ?? null;
  }
}

async function goBack() {
  await router.push("/stats");
}

onMounted(() => {
  document.body.style.overflow = "hidden";
  load();
});

onUnmounted(() => {
  document.body.style.overflow = "";
});
</script>

<template>
  <div class="attemptPage">
    <div v-if="!attempt">
      <EmptyState :title="$t('attempt.notFound')" :hint="$t('attempt.notFoundHint')" />
      <div class="row" style="margin-top:12px">
        <button class="btn" @click="goBack">{{ $t("attempt.backToStats") }}</button>
      </div>
    </div>

    <div v-else class="card resultCard">
      <div class="row">
        <div>
          <h2 style="margin:0">{{ title }}</h2>
          <p class="small" style="margin:4px 0 0 0">
            {{ attempt.type }} • {{ percent01(attempt.score) }} • {{ formatDate(attempt.finishedAt) }}
            <span v-if="attempt.meta?.durationSeconds !== undefined">
              • ⏱ {{ formatDuration(attempt.meta.durationSeconds) }}
            </span>
            <span v-if="attempt.meta?.correct !== undefined && attempt.meta?.total !== undefined">
              • {{ attempt.meta.correct }}/{{ attempt.meta.total }}
            </span>
          </p>
        </div>

        <div class="row" style="gap:8px">
          <button class="btn" @click="exportPdf" :disabled="!canExportPdf(attempt)">📄 PDF</button>
          <button class="btn" @click="goBack">{{ $t("common.back") }}</button>
        </div>
      </div>

      <div class="hr"></div>

      <div class="row" style="justify-content:flex-start; gap:10px">
        <label class="badge" style="cursor:pointer">
          <input type="checkbox" v-model="showOnlyWrong" />
          {{ $t("attempt.onlyWrong") }}
        </label>
        <span class="small">{{ filtered.length }} / {{ details.length }}</span>
      </div>

      <div v-if="details.length === 0" style="margin-top:12px">
        <EmptyState :title="$t('attempt.noDetails')" :hint="$t('attempt.noDetailsHint')" />
      </div>

      <div v-else class="list resultList" style="margin-top:12px">
        <div v-for="(d, i) in filtered" :key="i" class="card" style="border-radius:18px">
          <div class="row">
            <span
                class="badge"
                :style="d.correct ? 'border-color: rgba(61,220,151,.65)' : 'border-color: rgba(255,107,107,.65)'"
            >
              {{ d.correct ? $t("report.ok") : $t("report.wrong") }}
            </span>
            <span class="small">#{{ i + 1 }}</span>
          </div>

          <template v-if="d.kind === 'sentence_order'">
            <h3 style="margin:10px 0 0 0">{{ d.text }}</h3>
            <p v-if="d.translation" class="small" style="margin:6px 0 0 0">{{ $t("attempt.translation", { text: d.translation }) }}</p>

            <div class="hr"></div>
            <p class="small" style="margin:0"><b>{{ $t("report.labels.yourAnswer") }}:</b> {{ answerSentence(d) }}</p>
            <p class="small" style="margin:6px 0 0 0"><b>{{ $t("report.labels.correction") }}:</b> {{ correctionSentence(d) }}</p>
          </template>

          <template v-else-if="d.kind === 'flashcard'">
            <h3 style="margin:10px 0 0 0">{{ d.term }}</h3>
            <p class="small" style="margin:6px 0 0 0">{{ $t("report.labels.answer") }}: {{ d.definition }}</p>
            <div class="hr"></div>
            <p class="small" style="margin:0">
              <b>{{ $t("attempt.status") }}:</b> {{ d.known ? $t("report.known") : $t("report.unknown") }}
            </p>
          </template>

          <template v-else-if="isTypedDetail(d)">
            <h3 style="margin:10px 0 0 0">{{ d.prompt }}</h3>
            <div class="hr"></div>
            <p class="small" style="margin:0"><b>{{ $t("report.labels.yourAnswer") }}:</b> {{ d.answer || $t("common.empty") }}</p>
            <p class="small" style="margin:6px 0 0 0"><b>{{ $t("report.labels.expected") }}:</b> {{ d.expected }}</p>
          </template>

          <template v-else>
            <h3 style="margin:10px 0 0 0">{{ d.prompt }}</h3>
            <div class="hr"></div>
            <p class="small" style="margin:0"><b>{{ $t("report.labels.yourAnswer") }}:</b> {{ pickedText(d) }}</p>
            <p class="small" style="margin:6px 0 0 0"><b>{{ $t("report.labels.rightAnswer") }}:</b> {{ correctText(d) }}</p>
            <p v-if="d.kind === 'exam_mcq' && d.explanation" class="small" style="margin:6px 0 0 0">
              <b>{{ $t("report.labels.explanation") }}:</b> {{ d.explanation }}
            </p>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
