<script setup lang="ts">
/**
 * Page pour créer facilement un JSON (vocab_deck ou qcm_exam) sans écrire à la main.
 * - Formulaires simplifiés
 * - Preview JSON
 * - Copier / Télécharger
 * - Option bonus: importer directement dans l'app (IndexedDB)
 */
import { computed, ref } from "vue";
import { importQcmExam, importVocabDeck } from "../services/importer";
import type { QcmExamJson, VocabDeckJson } from "../types/json";
import ConfirmBar from "../components/ConfirmBar.vue";

type Mode = "vocab" | "exam";
const mode = ref<Mode>("vocab");

const msg = ref<{ kind: "info" | "ok" | "danger"; text: string } | null>(null);
function setMsg(kind: "info" | "ok" | "danger", text: string) {
  msg.value = { kind, text };
}

/** -------- Vocab builder -------- */
const v_id = ref("en-fr-basics");
const v_title = ref("EN → FR - Basics");
const v_from = ref("en");
const v_to = ref("fr");
const v_items = ref<Array<{ id: string; term: string; definition: string }>>([
  { id: "1", term: "apple", definition: "pomme" },
  { id: "2", term: "to run", definition: "courir" }
]);

function addVocabItem() {
  const nextId = String(v_items.value.length + 1);
  v_items.value.push({ id: nextId, term: "", definition: "" });
}
function removeVocabItem(i: number) {
  v_items.value.splice(i, 1);
}

const vocabJsonObj = computed<VocabDeckJson>(() => ({
  type: "vocab_deck",
  id: v_id.value.trim(),
  title: v_title.value.trim(),
  from: v_from.value.trim(),
  to: v_to.value.trim(),
  items: v_items.value
      .filter(x => x.term.trim() && x.definition.trim())
      .map(x => ({ id: x.id.trim() || cryptoFallbackId(), term: x.term.trim(), definition: x.definition.trim() }))
}));

/** -------- Exam builder -------- */
const e_id = ref("net-001");
const e_title = ref("Réseaux - QCM 1");
const e_durationMin = ref<number>(15);

type ExamChoice = { id: string; text: string; correct: boolean };
type ExamQuestion = { id: string; prompt: string; explanation?: string; choices: ExamChoice[] };

function makeDefaultQuestion(n: number): ExamQuestion {
  return {
    id: `q${n}`,
    prompt: "",
    explanation: "",
    choices: [
      { id: "a", text: "", correct: false },
      { id: "b", text: "", correct: true },
      { id: "c", text: "", correct: false },
      { id: "d", text: "", correct: false }
    ]
  };
}

const e_questions = ref<ExamQuestion[]>([
  {
    id: "q1",
    prompt: "Quel port utilise HTTPS par défaut ?",
    explanation: "HTTPS utilise 443 par défaut.",
    choices: [
      { id: "a", text: "80", correct: false },
      { id: "b", text: "443", correct: true },
      { id: "c", text: "22", correct: false },
      { id: "d", text: "21", correct: false }
    ]
  }
]);

function addExamQuestion() {
  e_questions.value.push(makeDefaultQuestion(e_questions.value.length + 1));
}
function removeExamQuestion(i: number) {
  e_questions.value.splice(i, 1);
}
function setCorrectChoice(qIndex: number, choiceId: string) {
  const q = e_questions.value[qIndex];
  q.choices = q.choices.map(c => ({ ...c, correct: c.id === choiceId }));
}

const examJsonObj = computed<QcmExamJson>(() => ({
  type: "qcm_exam",
  id: e_id.value.trim(),
  title: e_title.value.trim(),
  durationSeconds: Math.max(0, Math.round((e_durationMin.value || 0) * 60)),
  questions: e_questions.value
      .filter(q => q.prompt.trim())
      .map(q => ({
        id: q.id.trim() || cryptoFallbackId(),
        prompt: q.prompt.trim(),
        explanation: q.explanation?.trim() || undefined,
        choices: q.choices
            .filter(c => c.text.trim())
            .map(c => ({ id: c.id, text: c.text.trim(), correct: c.correct }))
      }))
}));

/** -------- Preview JSON -------- */
const jsonText = computed(() => {
  const obj = mode.value === "vocab" ? vocabJsonObj.value : examJsonObj.value;
  return JSON.stringify(obj, null, 2);
});

/** -------- Actions -------- */
async function copyToClipboard() {
  try {
    await navigator.clipboard.writeText(jsonText.value);
    setMsg("ok", "JSON copié dans le presse-papiers ✅");
  } catch {
    setMsg("danger", "Impossible de copier (droits navigateur). Utilise le champ JSON et copie manuellement.");
  }
}

function downloadJson() {
  const fileName =
      (mode.value === "vocab" ? vocabJsonObj.value.id : examJsonObj.value.id) || "export";
  const blob = new Blob([jsonText.value], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileName}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
  setMsg("ok", "Fichier JSON téléchargé ✅");
}

function validateCurrent(): string | null {
  if (mode.value === "vocab") {
    const v = vocabJsonObj.value;
    if (!v.id) return "Deck: id obligatoire.";
    if (!v.title) return "Deck: titre obligatoire.";
    if (v.items.length < 1) return "Deck: ajoute au moins 1 item (term + definition).";
    return null;
  }

  const e = examJsonObj.value;
  if (!e.id) return "Exam: id obligatoire.";
  if (!e.title) return "Exam: titre obligatoire.";
  if (e.questions.length < 1) return "Exam: ajoute au moins 1 question.";
  // Vérifie qu'il y a une bonne réponse par question
  for (const q of e.questions) {
    const correctCount = q.choices.filter(c => c.correct).length;
    if (correctCount !== 1) return `Question "${q.id}": il faut exactement 1 bonne réponse.`;
    if (q.choices.length < 2) return `Question "${q.id}": au moins 2 choix.`;
  }
  return null;
}

async function importIntoApp() {
  const err = validateCurrent();
  if (err) {
    setMsg("danger", err);
    return;
  }
  setMsg("info", "Import en cours…");

  try {
    if (mode.value === "vocab") {
      const res = await importVocabDeck(vocabJsonObj.value);
      setMsg("ok", `Importé dans l'app: ${res.title} (${res.count} items) ✅`);
    } else {
      const res = await importQcmExam(examJsonObj.value);
      setMsg("ok", `Importé dans l'app: ${res.title} (${res.count} questions) ✅`);
    }
  } catch (e) {
    setMsg("danger", "Erreur lors de l'import local.");
  }
}

function cryptoFallbackId(): string {
  // fallback simple si l'utilisateur vide des id
  return `id_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}
</script>

<template>
  <div class="grid cols-2">
    <div class="card">
      <h2>Créateur de JSON</h2>
      <p>Crée un fichier JSON sans écrire le format à la main. Puis télécharge ou importe directement dans l'app.</p>

      <div class="row">
        <button class="btn" :class="{ primary: mode === 'vocab' }" @click="mode = 'vocab'">Vocab</button>
        <button class="btn" :class="{ primary: mode === 'exam' }" @click="mode = 'exam'">Exam QCM</button>
      </div>

      <div v-if="msg" style="margin-top:12px">
        <ConfirmBar :message="msg.text" :kind="msg.kind" />
      </div>

      <div class="hr"></div>

      <!-- VOCAB -->
      <div v-if="mode === 'vocab'">
        <h3>Deck vocab</h3>

        <label class="small">ID deck</label>
        <input class="input" v-model="v_id" placeholder="ex: en-fr-basics" />

        <label class="small" style="margin-top:8px; display:block">Titre</label>
        <input class="input" v-model="v_title" placeholder="ex: EN → FR - Basics" />

        <div class="row" style="margin-top:8px">
          <div style="flex:1; min-width:160px">
            <label class="small">Langue source</label>
            <input class="input" v-model="v_from" placeholder="en" />
          </div>
          <div style="flex:1; min-width:160px">
            <label class="small">Langue cible</label>
            <input class="input" v-model="v_to" placeholder="fr" />
          </div>
        </div>

        <div class="hr"></div>

        <div class="row">
          <h3 style="margin:0">Items</h3>
          <button class="btn" @click="addVocabItem">+ Ajouter</button>
        </div>

        <div class="list" style="margin-top:10px">
          <div v-for="(it, i) in v_items" :key="i" class="card">
            <div class="row">
              <b>#{{ it.id }}</b>
              <button class="btn danger" @click="removeVocabItem(i)">Supprimer</button>
            </div>
            <label class="small" style="margin-top:8px; display:block">Mot / terme</label>
            <input class="input" v-model="it.term" placeholder="ex: apple" />
            <label class="small" style="margin-top:8px; display:block">Traduction / définition</label>
            <input class="input" v-model="it.definition" placeholder="ex: pomme" />
          </div>
        </div>
      </div>

      <!-- EXAM -->
      <div v-else>
        <h3>Exam QCM</h3>

        <label class="small">ID exam</label>
        <input class="input" v-model="e_id" placeholder="ex: net-001" />

        <label class="small" style="margin-top:8px; display:block">Titre</label>
        <input class="input" v-model="e_title" placeholder="ex: Réseaux - QCM 1" />

        <label class="small" style="margin-top:8px; display:block">Durée (minutes)</label>
        <input class="input" type="number" min="0" v-model.number="e_durationMin" />

        <div class="hr"></div>

        <div class="row">
          <h3 style="margin:0">Questions</h3>
          <button class="btn" @click="addExamQuestion">+ Ajouter</button>
        </div>

        <div class="list" style="margin-top:10px">
          <div v-for="(q, qi) in e_questions" :key="qi" class="card">
            <div class="row">
              <b>{{ q.id }}</b>
              <button class="btn danger" @click="removeExamQuestion(qi)">Supprimer</button>
            </div>

            <label class="small" style="margin-top:8px; display:block">Question</label>
            <input class="input" v-model="q.prompt" placeholder="Écris la question..." />

            <label class="small" style="margin-top:8px; display:block">Explication (optionnel)</label>
            <input class="input" v-model="q.explanation" placeholder="Pourquoi la bonne réponse..." />

            <div class="hr"></div>

            <div class="small">Choix (sélectionne la bonne réponse)</div>
            <div class="list" style="margin-top:8px">
              <div v-for="c in q.choices" :key="c.id" class="row" style="gap:8px">
                <input
                    type="radio"
                    :name="`correct-${qi}`"
                    :checked="c.correct"
                    @change="setCorrectChoice(qi, c.id)"
                />
                <span class="badge">{{ c.id }}</span>
                <input class="input" v-model="c.text" placeholder="Texte du choix..." style="flex:1; min-width:220px" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="hr"></div>

      <div class="row">
        <button class="btn" @click="copyToClipboard">Copier JSON</button>
        <button class="btn" @click="downloadJson">Télécharger .json</button>
        <button class="btn ok" @click="importIntoApp">Importer dans l'app</button>
      </div>

      <p class="small" style="margin-top:10px">
        Astuce: si tu importes dans l'app, tu peux ensuite lancer quiz/exam directement.
      </p>
    </div>

    <div class="card">
      <h2>Preview JSON</h2>
      <p class="small">Ceci est le fichier généré.</p>
      <textarea class="input" style="min-height: 520px; resize: vertical" :value="jsonText" readonly></textarea>
      <div class="hr"></div>
      <router-link class="btn" to="/import">Aller à Import</router-link>
    </div>
  </div>
</template>
