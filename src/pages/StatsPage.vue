<script setup lang="ts">
import { confirmDialog, toast } from "../services/dialog";
import { computed, onMounted, onUnmounted, ref } from "vue";
import { db, type Attempt, type VocabDeck, type Exam, type ReviewState, type VocabItem } from "../db";
import ActivityChart from "../components/ActivityChart.vue";
import { activityByDay, deckProgress, hardestWords, streak } from "../services/stats";
import EmptyState from "../components/EmptyState.vue";
import { formatDate, formatDuration } from "../utils/time";
import { exportAttemptPdf } from "../services/pdfReport";

const attempts = ref<Attempt[]>([]);
const decks = ref<Record<string, VocabDeck>>({});
const exams = ref<Record<string, Exam>>({});
const items = ref<VocabItem[]>([]);
const reviews = ref<ReviewState[]>([]);
const tab = ref<"history" | "decks" | "hard">("history");

const streakDays = computed(() => streak(attempts.value));
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
  if (a.type === "exam") return exams.value[a.refId]?.title ?? `Exam ${a.refId}`;
  if (a.type === "practice") return "Exam (tags)";
  if (a.type === "flashcards" && a.refId === "review") return "Révision du jour";
  return decks.value[a.refId]?.title ?? `Deck ${a.refId}`;
}

function metaLine(a: Attempt): string {
  const parts: string[] = [];
  if (a.meta?.durationSeconds !== undefined) parts.push(`⏱ ${formatDuration(a.meta.durationSeconds)}`);
  if (a.meta?.correct !== undefined && a.meta?.total !== undefined) parts.push(`✅ ${a.meta.correct}/${a.meta.total}`);
  if (a.type === "practice" && a.meta?.breakdown) {
    const b = a.meta.breakdown;
    const labels: Record<string, string> = { vocab: "Vocab", exam: "QCM", order: "SPOK", typed: "Écrit", cloze: "Trous", dictation: "Dictée" };
    parts.push(Object.entries(b).filter(([, n]) => n).map(([k, n]) => `${labels[k] ?? k}:${n}`).join(" "));
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
  items.value = await db.vocabItems.toArray();
  reviews.value = await db.reviews.toArray();
}

async function clearStats() {
  if (!(await confirmDialog("Supprimer uniquement les stats (tentatives) ?"))) return;
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
    toast(e instanceof Error ? e.message : "Impossible d'exporter le PDF", "danger");
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
            <div>
              <div class="small">Série</div>
              <div class="kpi">🔥 {{ streakDays }} j</div>
            </div>
          </div>
          <div class="hr"></div>
          <button class="btn danger" @click="clearStats">Reset stats</button>
        </div>

        <div class="card topCard">
          <h2>Activité</h2>
          <ActivityChart :days="activity" />
        </div>
      </div>
    </div>

    <div class="card historyCard">
      <div class="row" style="align-items:flex-end">
        <div class="pills">
          <button class="pill" :class="{ active: tab === 'history' }" @click="tab = 'history'">Historique</button>
          <button class="pill" :class="{ active: tab === 'decks' }" @click="tab = 'decks'">Progression decks</button>
          <button class="pill" :class="{ active: tab === 'hard' }" @click="tab = 'hard'">Mots difficiles</button>
        </div>
        <div v-if="tab === 'history'" class="small" style="opacity:.85">
          {{ attempts.length }} entrées
        </div>
        <div v-else-if="tab === 'decks'" class="small">
          <span class="legendSwatch stage-fresh"></span>Nouvelles
          <span class="legendSwatch stage-learning ml-2"></span>En cours
          <span class="legendSwatch stage-mastered ml-2"></span>Maîtrisées (≥ 21 j)
        </div>
      </div>

      <div class="hr"></div>

      <template v-if="tab === 'decks'">
        <EmptyState v-if="progress.length === 0" title="Aucun deck" hint="Importe un deck vocab puis révise-le." />
        <div v-else class="list historyList">
          <div v-for="p in progress" :key="p.deckId" class="card" style="border-radius:18px">
            <div class="row mb-2">
              <h3 class="m-0">{{ decks[p.deckId]?.title ?? p.deckId }}</h3>
              <span class="small">
                {{ p.fresh }} nouvelles • {{ p.learning }} en cours • <b class="text-text">{{ p.mastered }}</b> maîtrisées / {{ p.total }}
              </span>
            </div>
            <div class="progressBar" role="img" :aria-label="`${p.mastered} maîtrisées sur ${p.total}`">
              <span v-if="p.mastered" class="stage-mastered" :style="{ width: pct(p.mastered, p.total) }" :title="`${p.mastered} maîtrisées`"></span>
              <span v-if="p.learning" class="stage-learning" :style="{ width: pct(p.learning, p.total) }" :title="`${p.learning} en cours`"></span>
              <span v-if="p.fresh" class="stage-fresh" :style="{ width: pct(p.fresh, p.total) }" :title="`${p.fresh} nouvelles`"></span>
            </div>
          </div>
        </div>
      </template>

      <template v-else-if="tab === 'hard'">
        <EmptyState v-if="hard.length === 0" title="Aucun mot difficile" hint="Les cartes souvent oubliées en révision apparaîtront ici." />
        <div v-else class="list historyList">
          <div v-for="h in hard" :key="h.item.id" class="row card" style="border-radius:18px">
            <div>
              <h3 class="m-0">{{ h.item.term }}</h3>
              <p class="small m-0">{{ h.item.definition }} • {{ decks[h.item.deckId]?.title }}</p>
            </div>
            <span class="badge">oubliée {{ h.lapses }}×</span>
          </div>
        </div>
      </template>

      <div v-else-if="attempts.length === 0">
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
                  :title="'Exporter les détails en PDF'"
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

