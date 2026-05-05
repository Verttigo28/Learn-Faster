<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import EmptyState from "../components/EmptyState.vue";
import { db, type Attempt, type AttemptDetail, type Exam, type VocabDeck } from "../db";
import { exportAttemptPdf } from "../services/pdfReport";
import { formatDate, formatDuration } from "../utils/time";
import { useToast } from "../composables/useToast";

const toast = useToast();

const props = defineProps<{ attemptId?: string }>();
const route = useRoute();
const router = useRouter();

const attemptId = computed(() => props.attemptId ?? String(route.params.attemptId));

const attempt = ref<Attempt | null>(null);
const exam = ref<Exam | null>(null);
const deck = ref<VocabDeck | null>(null);

const showOnlyWrong = ref(false);

const title = computed(() => {
  if (!attempt.value) return "Résultat";
  if (attempt.value.type === "exam") return exam.value?.title ?? `Exam ${attempt.value.refId}`;
  if (attempt.value.type === "vocab_quiz") return deck.value?.title ?? `Deck ${attempt.value.refId}`;
  if (attempt.value.type === "practice") return "Exam (tags)";
  if (attempt.value.type === "flashcards") return deck.value?.title ?? `Flashcards ${attempt.value.refId}`;
  return "Résultat";
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
  return d.options.find((o) => o.id === d.pickedId)?.text ?? "aucune";
}
function correctText(d: Extract<AttemptDetail, { kind: "vocab_mcq" | "exam_mcq" }>) {
  return d.options.find((o) => o.correct)?.text ?? "(inconnue)";
}

function answerSentence(d: Extract<AttemptDetail, { kind: "sentence_order" }>) {
  return (d.answer ?? []).join(" ") || "(vide)";
}
function correctionSentence(d: Extract<AttemptDetail, { kind: "sentence_order" }>) {
  return (d.tokens ?? []).join(" ");
}

function canExportPdf(a: Attempt | null): boolean {
  return !!a && !!a.meta?.details?.length;
}

function exportPdf() {
  if (!attempt.value) return;
  try {
    exportAttemptPdf(attempt.value, title.value);
  } catch (e: any) {
    toast.error(e?.message ?? "Impossible d'exporter le PDF");
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
      <EmptyState title="Résultat introuvable" hint="Cette tentative n'existe plus dans la base locale." icon="🔎" />
      <div class="row mt-3">
        <button class="btn" @click="goBack">Retour stats</button>
      </div>
    </div>

    <div v-else class="card resultCard">
      <div class="row">
        <div>
          <h2 class="m-0">{{ title }}</h2>
          <p class="small mt-1 mb-0">
            {{ attempt.type }} • {{ percent01(attempt.score) }} • {{ formatDate(attempt.finishedAt) }}
            <span v-if="attempt.meta?.durationSeconds !== undefined">
              • ⏱ {{ formatDuration(attempt.meta.durationSeconds) }}
            </span>
            <span v-if="attempt.meta?.correct !== undefined && attempt.meta?.total !== undefined">
              • {{ attempt.meta.correct }}/{{ attempt.meta.total }}
            </span>
          </p>
        </div>

        <div class="row gap-2">
          <button class="btn" @click="exportPdf" :disabled="!canExportPdf(attempt)">📄 PDF</button>
          <button class="btn" @click="goBack">Retour</button>
        </div>
      </div>

      <div class="hr"></div>

      <div class="row justify-start gap-2.5">
        <label class="badge cursor-pointer">
          <input type="checkbox" v-model="showOnlyWrong" />
          Voir seulement les erreurs
        </label>
        <span class="small">{{ filtered.length }} / {{ details.length }}</span>
      </div>

      <div v-if="details.length === 0" class="mt-3">
        <EmptyState title="Aucun détail" hint="Cette tentative est trop ancienne. Relance un exam pour enregistrer les détails." icon="⏳" />
      </div>

      <div v-else class="list resultList mt-3">
        <div v-for="(d, i) in filtered" :key="i" class="card rounded-[18px]">
          <div class="row">
            <span class="badge" :class="d.correct ? 'result-ok' : 'result-wrong'">
              {{ d.correct ? "OK" : "Faux" }}
            </span>
            <span class="small">#{{ i + 1 }}</span>
          </div>

          <template v-if="d.kind === 'sentence_order'">
            <h3 class="mt-2.5 mb-0">{{ d.text }}</h3>
            <p v-if="d.translation" class="small mt-1.5 mb-0">FR: {{ d.translation }}</p>

            <div class="hr"></div>
            <p class="small m-0"><b>Ta réponse:</b> {{ answerSentence(d) }}</p>
            <p class="small mt-1.5 mb-0"><b>Correction:</b> {{ correctionSentence(d) }}</p>
          </template>

          <template v-else-if="d.kind === 'flashcard'">
            <h3 class="mt-2.5 mb-0">{{ d.term }}</h3>
            <p class="small mt-1.5 mb-0">Réponse: {{ d.definition }}</p>
            <div class="hr"></div>
            <p class="small m-0">
              <b>Statut:</b> {{ d.known ? "Je sais" : "Je ne sais pas" }}
            </p>
          </template>

          <template v-else>
            <h3 class="mt-2.5 mb-0">{{ d.prompt }}</h3>
            <div class="hr"></div>
            <p class="small m-0"><b>Ta réponse:</b> {{ pickedText(d) }}</p>
            <p class="small mt-1.5 mb-0"><b>Bonne réponse:</b> {{ correctText(d) }}</p>
            <p v-if="d.kind === 'exam_mcq' && d.explanation" class="small mt-1.5 mb-0">
              <b>Explication:</b> {{ d.explanation }}
            </p>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.result-ok { border-color: rgb(var(--ok) / 0.65); color: rgb(var(--ok)); }
.result-wrong { border-color: rgb(var(--danger) / 0.65); color: rgb(var(--danger)); }
</style>
