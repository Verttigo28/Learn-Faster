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

  // Random “uniforme” via offset
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

  // Dexie typings: pass tables as ARRAY
  await db.transaction(
      "rw",
      [db.vocabDecks, db.vocabItems, db.exams, db.examQuestions, db.sentenceExercises, db.attempts],
      async () => {
        await db.vocabDecks.clear();
        await db.vocabItems.clear();
        await db.exams.clear();
        await db.examQuestions.clear();
        await db.sentenceExercises.clear();
        await db.attempts.clear();
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
            <div class="small">Phrases (SPOK)</div>
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
          <router-link class="btn startBtn" to="/practice?count=15&sources=vocab,exam,order">⚡ Exam 15 questions (V/Q/P)</router-link>

          <router-link class="btn startBtn" to="/practice?count=15&sources=order">🧩 Sprint 15 phrases</router-link>
          <router-link class="btn startBtn" to="/practice?count=15&sources=vocab">🗂️ Sprint 15 vocab</router-link>

          <router-link class="btn startBtn" to="/practice?count=15&sources=exam">📝 Sprint 15 QCM</router-link>
          <router-link class="btn startBtn" to="/practice?count=30&sources=vocab,exam,order">🔥 Exam 30 questions (V/Q/P)</router-link>

          <button class="btn startBtn" @click="startRandomFlashcards">🃏 Flashcards (deck aléatoire)</button>


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
          <router-link v-for="d in decks.slice(0, 3)" :key="d.id" class="card itemCard" :to="`/deck/${d.id}`">
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
            <h3 class="itemTitle">{{ e.title }}</h3>
            <div class="small">{{ examDurationLabel(e.durationSeconds) }}</div>
            <div class="itemFooter">
              <span class="badge">Démarrer</span>
            </div>
          </router-link>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.home{
  /* un peu plus large que la base, sans casser la responsivité */
  max-width: 1180px;
  margin: 0 auto;
}

/* Top cards +60px sans bouger le bas */
/* Top: 2 colonnes côte à côte, mais chaque card est plus large que sa colonne */
/* Top: 2 colonnes côte à côte, mais chaque card est plus large que sa colonne */
.top{
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  align-items: stretch;
}

/* +60px par card (donc +120px au total sur la rangée du haut) */
.dashboard,
.start{
  width: calc(100% + 60px);
}

/* On “pousse” vers l’extérieur pour garder le centre global OK
   => la rangée du haut devient plus large et donc excentrée vs le bas (voulu) */
.dashboard{ margin-left: -60px; } /* part vers la gauche */
.start{ margin-right: -60px; }    /* part vers la droite */

/* Sur petits écrans: on revient normal pour éviter scroll horizontal */
@media (max-width: 980px){
  .dashboard,
  .start{
    width: 100%;
    margin-left: 0;
    margin-right: 0;
  }
}



/* Les 2 cartes du haut doivent s'étirer et avoir la même hauteur */
.top > .card{
  height: 100%;
  display: flex;
  flex-direction: column;
}

.top > .card .actionsGrid{
  margin-top: auto;
}

/* IMPORTANT: startGrid reste en haut */
.top > .card .startGrid{
  margin-top: 10px; /* garde ton spacing normal */
}



/* tablette / petit laptop : reste “en une ligne” tant que possible */
@media (max-width: 980px) {
  .top{
    grid-template-columns: 1fr; /* sur très petit écran, ça passe en colonne */
  }
}

.head{
  display:flex;
  align-items:baseline;
  justify-content:space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.title{
  margin:0;
  font-size: 26px;
  letter-spacing: .2px;
}
.sub{ opacity: .85; }

.kpis{
  display:grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-top: 10px;
  margin-bottom: 10px;
}

@media (max-width: 640px) {
  .kpis{ grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

.kpiBox{
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 10px 12px;
  background: rgba(0,0,0,.14);
}
.kpi{
  font-size: 28px;
  font-weight: 800;
  line-height: 1.1;
  margin-top: 4px;
}

.actionsGrid{
  margin-top: 12px;
  display:grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  align-items: start;
}

.actionBtn{
  width: 100%;
  /* Uniformise <router-link> (a) et <button> : même layout + texte centré */
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  text-decoration: none;
  padding: 12px 12px;
  border-radius: 14px;
}

.actionBtn:hover{
  text-decoration: none; /* évite le underline des <a> */
}

.reset{
  grid-column: 1 / -1;
}

.exportHint{
  grid-column: 1 / -1;
  opacity: .85;
  padding-left: 2px;
  margin-top: 2px;
}

.startGrid{
  margin-top: 10px;
  display:grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

@media (max-width: 520px) {
  .startGrid{ grid-template-columns: 1fr; }
}

.startBtn{
  width: 100%;
  justify-content: center;
  padding: 12px 12px;
  border-radius: 14px;
}

.tip{
  margin-top: 12px;
  opacity: .9;
}

/* 2 colonnes toujours parallèles et de même hauteur */
.bottom{
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-top: 14px;
  align-items: stretch; /* les 2 colonnes ont la même hauteur */
}

/* Chaque colonne (section) devient un conteneur flex vertical */
.bottom > section{
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

/* La liste occupe toute la hauteur de la colonne */
.bottom > section .listGrid{
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* Les cards se partagent la hauteur dispo de manière égale */
.bottom > section .itemCard{
  flex: 1;              /* <-- clé: même hauteur par card dans une colonne */
  display: flex;
  flex-direction: column;
}

/* Footer en bas à droite reste OK */
.itemFooter{
  margin-top: auto;
  display: flex;
  justify-content: flex-end;
  padding-top: 10px;
}


.sectionTitle h2{
  margin: 0 0 10px 0;
  font-size: 20px;
}

.listGrid{
  display:grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.itemCard{
  border-radius: 18px;
  padding: 14px;
  text-decoration: none;
}

.itemTitle{
  margin: 0;
  font-size: 18px;
  line-height: 1.2;
}

/* Cards liste: force le bouton en bas à droite, toujours même endroit */
.itemCard{
  display: flex;
  flex-direction: column;
  gap: 6px;
}

</style>
