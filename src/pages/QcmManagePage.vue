<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { db, type Exam } from "../db";
import { uid } from "../utils/id";
import EmptyState from "../components/EmptyState.vue";
import ConfirmBar from "../components/ConfirmBar.vue";

const router = useRouter();

const exams = ref<Exam[]>([]);
const counts = ref<Record<string, number>>({});
const msg = ref<{ kind: "info" | "ok" | "danger"; text: string } | null>(null);

const title = ref("");
const durationMinutes = ref<number>(10);

function set(kind: "info" | "ok" | "danger", text: string) {
  msg.value = { kind, text };
}

async function load() {
  exams.value = await db.exams.orderBy("createdAt").reverse().toArray();
  const qs = await db.examQuestions.toArray();
  const map: Record<string, number> = {};
  for (const q of qs) map[q.examId] = (map[q.examId] ?? 0) + 1;
  counts.value = map;
}

async function createExam() {
  const t = title.value.trim();
  if (!t) return set("danger", "Titre requis.");

  const minutes = Math.max(0, Math.floor(durationMinutes.value || 0));

  const exam: Exam = {
    id: uid("exam"),
    title: t,
    durationSeconds: minutes ? minutes * 60 : undefined,
    createdAt: Date.now()
  };
  await db.exams.add(exam);
  title.value = "";
  set("ok", "Exam créé ✅");
  await load();
}

async function removeExam(id: string) {
  if (!confirm("Supprimer cet exam + toutes ses questions ?")) return;
  await db.transaction("rw", [db.exams, db.examQuestions], async () => {
    await db.exams.delete(id);
    await db.examQuestions.where("examId").equals(id).delete();
  });
  set("ok", "Exam supprimé ✅");
  await load();
}

async function editExam(id: string) {
  await router.push(`/qcm/${id}/edit`);
}

onMounted(load);
</script>

<template>
  <!-- ✅ Pas de scroll global : la page remplit la hauteur et seules les listes scrollent -->
  <div class="manageGrid">
    <div class="card cardFill">
      <div class="scrollY">
      <h2>QCM — gérer les exams</h2>
      <p class="small">Crée un exam puis édite ses questions (choix, explications, tags).</p>

      <div class="hr"></div>

      <h3>Nouvel exam</h3>
      <label class="small">Titre</label>
      <input class="input" v-model="title" placeholder="ex: Présent - négation" />

      <label class="small" style="margin-top:8px; display:block">Durée (minutes, optionnel)</label>
      <input class="input" type="number" min="0" v-model.number="durationMinutes" />

      <div class="row" style="margin-top:12px">
        <button class="btn" @click="createExam">Créer</button>
        <router-link class="btn" to="/exams">Se lancer dans un exam</router-link>
      </div>

      <div v-if="msg" style="margin-top:12px">
        <ConfirmBar :message="msg.text" :kind="msg.kind" />
      </div>
      </div>
    </div>

    <div class="card cardFill">
      <div class="row flex-none mb-2.5">
        <h2 class="m-0">Liste des exams</h2>
        <span class="small">{{ exams.length }}</span>
      </div>

      <div v-if="exams.length === 0" class="flex-1 min-h-0 flex items-center justify-center">
        <EmptyState title="Aucun exam" hint="Crée ton premier exam à gauche, ou importe un JSON." />
      </div>

      <div v-else class="scrollY">
        <div class="list">
          <div v-for="e in exams" :key="e.id" class="card">
            <div class="row">
              <div>
                <h3 class="m-0">{{ e.title }}</h3>
                <p class="small mt-1">
                  {{ counts[e.id] ?? 0 }} questions
                  <span v-if="e.durationSeconds"> • Durée: {{ Math.round(e.durationSeconds / 60) }} min</span>
                </p>
              </div>
              <div class="row" style="gap:8px">
                <button class="btn" @click="editExam(e.id)">Éditer</button>
                <button class="btn danger" @click="removeExam(e.id)">Supprimer</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
