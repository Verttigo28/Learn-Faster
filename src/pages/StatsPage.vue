<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { db, type Attempt, type VocabDeck, type Exam } from "../db";
import EmptyState from "../components/EmptyState.vue";
import ConfirmModal from "../components/ConfirmModal.vue";
import { formatDate, formatDuration } from "../utils/time";
import { exportAttemptPdf } from "../services/pdfReport";
import { useToast } from "../composables/useToast";

const toast = useToast();
const showClearConfirm = ref(false);

const attempts = ref<Attempt[]>([]);
const decks = ref<Record<string, VocabDeck>>({});
const exams = ref<Record<string, Exam>>({});

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
  if (a.type === "exam") return exams.value[a.refId]?.title ?? `Exam ${a.refId}`;
  if (a.type === "practice") return "Exam (tags)";
  return decks.value[a.refId]?.title ?? `Deck ${a.refId}`;
}

function metaLine(a: Attempt): string {
  const parts: string[] = [];
  if (a.meta?.durationSeconds !== undefined) parts.push(`⏱ ${formatDuration(a.meta.durationSeconds)}`);
  if (a.meta?.correct !== undefined && a.meta?.total !== undefined) parts.push(`✅ ${a.meta.correct}/${a.meta.total}`);
  if (a.type === "practice" && a.meta?.breakdown) {
    const b = a.meta.breakdown;
    parts.push(`Vocab:${b.vocab ?? 0} QCM:${b.exam ?? 0} SPOK:${b.order ?? 0}`);
  }
  if (a.type === "practice" && a.meta?.tags?.length) {
    parts.push(`Tags: ${a.meta.tags.join(", ")}`);
  }
  return parts.join(" • ");
}

async function load() {
  attempts.value = await db.attempts.orderBy("finishedAt").reverse().toArray();

  const d = await db.vocabDecks.toArray();
  decks.value = Object.fromEntries(d.map((x) => [x.id, x]));

  const e = await db.exams.toArray();
  exams.value = Object.fromEntries(e.map((x) => [x.id, x]));
}

async function clearStats() {
  showClearConfirm.value = false;
  await db.attempts.clear();
  toast.success("Historique supprime.");
  await load();
}

function canOpenResult(a: Attempt): boolean {
  if (a.type === "flashcards") return true;
  return !!a.meta?.details?.length;
}

function typeBadgeClass(type: string): string {
  switch (type) {
    case "flashcards": return "badge-flashcards";
    case "exam": return "badge-exam";
    case "practice": return "badge-practice";
    case "vocab_quiz": return "badge-vocab";
    default: return "";
  }
}

function exportPdf(a: Attempt) {
  try {
    exportAttemptPdf(a, titleFor(a));
    toast.success("PDF exporte !");
  } catch (e: any) {
    toast.error(e?.message ?? "Impossible d'exporter le PDF");
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
    <div class="top">
      <div class="grid cols-2">
        <div class="card topCard">
          <h2>Stats</h2>
          <div class="row">
            <div>
              <div class="small">Tentatives</div>
              <div class="kpi">{{ totalAttempts }}</div>
            </div>
            <div>
              <div class="small">Score moyen</div>
              <div class="kpi">{{ percent01(avgScore01) }}</div>
            </div>
            <div>
              <div class="small">7 derniers jours</div>
              <div class="kpi">{{ percent01(last7Score01) }}</div>
            </div>
          </div>
          <div class="hr"></div>
          <button class="btn danger" @click="showClearConfirm = true">Reset stats</button>
        </div>

        <div class="card topCard">
          <h2>Types</h2>
          <p><b>flashcards</b> : "Je sais" / repondus</p>
          <p><b>vocab_quiz</b> : QCM genere depuis vocab</p>
          <p><b>exam</b> : QCM importe</p>
          <p><b>practice</b> : exam genere par tags (vocab + QCM + SPOK)</p>
        </div>
      </div>
    </div>

    <div class="card historyCard">
      <div class="row items-end">
        <div>
          <h2 class="m-0">Historique</h2>
          <p class="small mt-1.5 mb-0">
            Clique sur "Resultat" pour revoir les corrections (si disponibles).
          </p>
        </div>
        <div class="small opacity-85">
          {{ attempts.length }} entrees
        </div>
      </div>

      <div class="hr"></div>

      <div v-if="attempts.length === 0">
        <EmptyState title="Aucune tentative" hint="Fais un quiz vocab, un exam, ou un exam par tags pour voir l'historique." />
      </div>

      <div v-else class="list historyList">
        <div v-for="a in attempts" :key="a.id" class="card rounded-[18px]">
          <div class="row">
            <div>
              <h3 class="m-0">{{ titleFor(a) }}</h3>
              <p class="small mt-1 mb-0">
                {{ percent01(a.score) }} &bull; {{ formatDate(a.finishedAt) }}
                <span v-if="metaLine(a)"> &bull; {{ metaLine(a) }}</span>
              </p>
            </div>

            <div class="row gap-2">
              <router-link
                  class="btn"
                  :to="`/attempt/${a.id}`"
                  :title="canOpenResult(a) ? 'Voir le resultat' : 'Details indisponibles (ancienne stat)'"
                  :class="{ 'pointer-events-none opacity-60': !canOpenResult(a) }"
              >
                Resultat
              </router-link>

              <button
                  class="btn"
                  title="Exporter les details en PDF"
                  @click="exportPdf(a)"
              >
                PDF
              </button>
              <span class="badge" :class="typeBadgeClass(a.type)">{{ a.type }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <ConfirmModal
      :open="showClearConfirm"
      title="Supprimer l'historique"
      message="Supprimer toutes les tentatives ? Cette action est irreversible."
      confirm-text="Supprimer"
      :danger="true"
      @confirm="clearStats"
      @cancel="showClearConfirm = false"
    />
  </div>
</template>

<style scoped>
.badge-flashcards { border-color: rgb(var(--accent) / 0.5); color: rgb(var(--accent)); }
.badge-exam { border-color: rgb(var(--ok) / 0.5); color: rgb(var(--ok)); }
.badge-practice { border-color: rgb(255 180 50 / 0.5); color: rgb(255 180 50); }
.badge-vocab { border-color: rgb(var(--muted) / 0.5); color: rgb(var(--muted)); }
</style>
