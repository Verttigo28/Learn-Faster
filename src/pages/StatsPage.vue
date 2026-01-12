<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { db, type Attempt, type VocabDeck, type Exam } from "../db";
import EmptyState from "../components/EmptyState.vue";
import { formatDate, formatDuration } from "../utils/time";
import { exportAttemptPdf } from "../services/pdfReport";

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
  if (!confirm("Supprimer uniquement les stats (tentatives) ?")) return;
  await db.attempts.clear();
  await load();
}

function canExportPdf(a: Attempt): boolean {
  return (a.type === "exam" || a.type === "practice" || a.type === "vocab_quiz") && !!a.meta?.details?.length;
}

function canOpenResult(a: Attempt): boolean {
  if (a.type === "flashcards") return true;
  return !!a.meta?.details?.length;
}


function exportPdf(a: Attempt) {
  try {
    exportAttemptPdf(a, titleFor(a));
  } catch (e: any) {
    alert(e?.message ?? "Impossible d'exporter le PDF");
  }
}

onMounted(load);
</script>

<template>
  <div class="page">
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
          <button class="btn danger" @click="clearStats">Reset stats</button>
        </div>

        <div class="card topCard">
          <h2>Types</h2>
          <p>• <b>flashcards</b> : “Je sais” / répondus</p>
          <p>• <b>vocab_quiz</b> : QCM généré depuis vocab</p>
          <p>• <b>exam</b> : QCM importé</p>
          <p>• <b>practice</b> : exam généré par tags (vocab + QCM + SPOK)</p>
        </div>
      </div>
    </div>

    <div class="card historyCard">
      <div class="row" style="align-items:flex-end">
        <div>
          <h2 style="margin:0">Historique</h2>
          <p class="small" style="margin:6px 0 0 0">
            Clique sur “Résultat” pour revoir les corrections (si disponibles).
          </p>
        </div>
        <div class="small" style="opacity:.85">
          {{ attempts.length }} entrées
        </div>
      </div>

      <div class="hr"></div>

      <div v-if="attempts.length === 0">
        <EmptyState title="Aucune tentative" hint="Fais un quiz vocab, un exam, ou un exam par tags pour voir l'historique." />
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
                  :title="canOpenResult(a) ? 'Voir le résultat' : 'Détails indisponibles (ancienne stat)'"
                  :style="!canOpenResult(a) ? 'pointer-events:none; opacity:0.6' : ''"
              >
                Résultat
              </router-link>

              <button
                  class="btn"
                  :disabled="!canExportPdf(a)"
                  :title="canExportPdf(a) ? 'Exporter les détails en PDF' : 'PDF indisponible (anciennes stats sans détails)'"
                  @click="exportPdf(a)"
              >
                📄 PDF
              </button>

              <router-link
                  v-if="a.meta?.details?.length"
                  class="badge"
                  :to="`/attempt/${a.id}`"
                  style="cursor:pointer"
              >
                {{ a.type }}
              </router-link>
              <span v-else class="badge" style="opacity:0.6">{{ a.type }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Empêche le scroll global UNIQUEMENT quand cette page est affichée */
:global(html),
:global(body){
  height: 100%;
  overflow: hidden;
}

.top{
  flex: 0 0 auto;
}

.topCard{
  align-self: start;
}

.page{
  max-width: 1100px;
  margin: 0 auto;

  /* ✅ la page tient dans l'écran */
  height: calc(100vh - 32px);
  display: flex;
  flex-direction: column;
  gap: 12px;

  overflow: hidden;
}

/* Historique: un peu moins haut pour éviter la zone “coupée” en bas */
.historyCard{
  flex: 0 0 auto;              /* ✅ n'étire plus automatiquement */
  height: 58vh;                /* ✅ ajuste: 52–62vh selon ton goût */
  max-height: 520px;           /* ✅ limite sur grands écrans */
  min-height: 260px;           /* ✅ garde une taille mini */
  overflow: hidden;

  display: flex;
  flex-direction: column;
}

/* ✅ scroll garanti ici */
.historyList{
  flex: 1 1 auto;
  min-height: 0;               /* IMPORTANT */
  overflow: auto;
  padding-right: 6px;

  /* un peu d’air en bas pour le dernier item */
  padding-bottom: 18px;
}
</style>
