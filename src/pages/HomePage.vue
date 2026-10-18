<script setup lang="ts">
import { onMounted, ref } from "vue";
import { db, type VocabDeck, type Exam } from "../db";
import EmptyState from "../components/EmptyState.vue";
import { exportAllData, downloadJson } from "../services/exporter";
import { useRouter } from "vue-router";
const router = useRouter();

const decks = ref<VocabDeck[]>([]);
const exams = ref<Exam[]>([]);
const counts = ref({
  deckCount: 0,
  examCount: 0,
  sentenceCount: 0,
  attemptCount: 0
});

async function startRandomFlashcards() {
  const count = await db.vocabDecks.count();
  if (!count) {
    alert("Aucun deck vocab. Crée ou importe un deck d'abord.");
    return;
  }

  const offset = Math.floor(Math.random() * count);
  const deck = await db.vocabDecks.orderBy("createdAt").reverse().offset(offset).limit(1).first();

  if (!deck) {
    alert("Impossible de sélectionner un deck.");
    return;
  }

  await router.push(`/deck/${deck.id}/flash`);
}

const exportInfo = ref<string>("");

async function load() {
  decks.value = await db.vocabDecks.orderBy("createdAt").reverse().toArray();
  exams.value = await db.exams.orderBy("createdAt").reverse().toArray();

  counts.value = {
    deckCount: await db.vocabDecks.count(),
    examCount: await db.exams.count(),
    sentenceCount: await db.sentenceExercises.count(),
    attemptCount: await db.attempts.count()
  };
}

async function clearAll() {
  if (!confirm("Tout supprimer (decks/exams/phrases/stats) ?")) return;

  await db.transaction(
      "rw",
      db.tables,
      async () => {
        await Promise.all(db.tables.map((t) => t.clear()));
      }
  );

  await load();
}

async function exportAll() {
  const data = await exportAllData();
  const date = new Date().toISOString().slice(0, 10);
  downloadJson(`revisions_export_${date}.json`, data);
}

function examDurationLabel(seconds?: number) {
  if (!seconds) return "Sans timer";
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
}

onMounted(load);
</script>

<template>
  <div class="home">
    <!-- TOP ROW -->
    <div class="top">
      <!-- Dashboard -->
      <section class="card dashboard">
        <div class="head">
          <h2 class="title">Tableau de bord</h2>
          <div class="sub small">Stocké en mémoire</div>
        </div>

        <div class="kpis">
          <div class="kpiBox">
            <div class="small">Decks vocab</div>
            <div class="kpi">{{ counts.deckCount }}</div>
          </div>
          <div class="kpiBox">
            <div class="small">Exams</div>
            <div class="kpi">{{ counts.examCount }}</div>
          </div>
          <div class="kpiBox">
            <div class="small">Phrases</div>
            <div class="kpi">{{ counts.sentenceCount }}</div>
          </div>
          <div class="kpiBox">
            <div class="small">Tentatives</div>
            <div class="kpi">{{ counts.attemptCount }}</div>
          </div>
        </div>

        <div class="actionsGrid">
          <router-link class="btn actionBtn" to="/import">📥 Importer</router-link>
          <button class="btn actionBtn" @click="exportAll">⬇️ Exporter</button>

          <router-link class="btn actionBtn" to="/stats">📈 Stats</router-link>
          <router-link class="btn actionBtn" to="/sentences">🧩 Éditer phrases</router-link>

          <router-link class="btn actionBtn" to="/vocab">🗂️ Éditer vocab</router-link>
          <router-link class="btn actionBtn" to="/qcm">📝 Éditer QCM</router-link>

          <button class="btn danger actionBtn reset" @click="clearAll">🧹 Reset DB</button>

          <div class="exportHint small" v-if="exportInfo">{{ exportInfo }}</div>
        </div>
      </section>

      <!-- Start -->
      <section class="card start">
        <div class="head">
          <h2 class="title">Démarrer</h2>
          <div class="sub small">Sessions rapides</div>
        </div>

        <div class="startGrid">
          <router-link class="btn startBtn" to="/exams">🎯 Générer un examen</router-link>
          <router-link class="btn startBtn" to="/practice?count=15&sources=vocab,exam,order">⚡ Exam 15 questions VQP</router-link>

          <router-link class="btn startBtn" to="/practice?count=15&sources=order">🧩 Sprint 15 phrases</router-link>
          <router-link class="btn startBtn" to="/practice?count=15&sources=vocab">🗂️ Sprint 15 vocab</router-link>

          <router-link class="btn startBtn" to="/practice?count=15&sources=exam">📝 Sprint 15 QCM</router-link>
          <router-link class="btn startBtn" to="/practice?count=30&sources=vocab,exam,order">🔥 Exam 30 questions VQP</router-link>

          <button class="btn startBtn" @click="startRandomFlashcards">🃏 Flashcards (aléatoire)</button>
        </div>
      </section>
    </div>

    <!-- CONTENT LISTS -->
    <div class="bottom">
      <section>
        <div class="sectionTitle">
          <h2>Decks vocab</h2>
        </div>

        <div v-if="decks.length === 0">
          <EmptyState title="Aucun deck vocab" hint="Importe un deck en JSON." />
        </div>

        <div v-else class="listGrid">
          <router-link
              v-for="d in decks.slice(0, 3)"
              :key="d.id"
              class="card itemCard"
              :to="`/deck/${d.id}`"
          >
            <h3 class="itemTitle">{{ d.title }}</h3>

            <div class="itemFooter">
              <router-link class="badge" :to="`/deck/${d.id}/flash`">Flashcards</router-link>
              <span class="badge">Ouvrir</span>
            </div>
          </router-link>
        </div>
      </section>

      <section>
        <div class="sectionTitle">
          <h2>Exams QCM</h2>
        </div>

        <div v-if="exams.length === 0">
          <EmptyState title="Aucun exam" hint="Importe un QCM en JSON." />
        </div>

        <div v-else class="listGrid">
          <router-link
              v-for="e in exams.slice(0, 3)"
              :key="e.id"
              class="card itemCard"
              :to="`/exam/${e.id}`"
          >
            <h3 class="itemTitle">
              {{ e.title }}
              <span class="itemMeta">— {{ examDurationLabel(e.durationSeconds) }}</span>
            </h3>

            <div class="itemFooter">
              <span class="badge">Démarrer</span>
            </div>
          </router-link>
        </div>
      </section>
    </div>
  </div>
</template>
