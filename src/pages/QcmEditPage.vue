<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { db, type Exam, type ExamQuestion } from "../db";
import { uid } from "../utils/id";
import ConfirmBar from "../components/ConfirmBar.vue";
import EmptyState from "../components/EmptyState.vue";
import BaseModal from "../components/BaseModal.vue";

const props = defineProps<{ examId?: string }>();
const route = useRoute();
const router = useRouter();
const examId = computed(() => props.examId ?? String(route.params.examId));

const exam = ref<Exam | null>(null);
const questions = ref<ExamQuestion[]>([]);
const msg = ref<{ kind: "info" | "ok" | "danger"; text: string } | null>(null);

const examTitle = ref("");
const durationMinutes = ref<number>(10);

type ChoiceDraft = { id: string; text: string; correct: boolean };

const prompt = ref("");
const explanation = ref("");
const tagsText = ref("");
const choices = ref<ChoiceDraft[]>([
  { id: uid("c"), text: "", correct: true },
  { id: uid("c"), text: "", correct: false }
]);

const editOpen = ref(false);
const editQId = ref<string | null>(null);
const editPrompt = ref("");
const editExplanation = ref("");
const editTagsText = ref("");
const editChoices = ref<ChoiceDraft[]>([]);

function set(kind: "info" | "ok" | "danger", text: string) {
  msg.value = { kind, text };
}

function parseTags(input: string): string[] {
  return input
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function normalizeChoices(list: ChoiceDraft[]): ChoiceDraft[] {
  // supprime les choix vides
  const trimmed = list
    .map((c) => ({ ...c, text: c.text.trim() }))
    .filter((c) => c.text.length > 0);
  // garantit 1 correct min
  if (trimmed.length && !trimmed.some((c) => c.correct)) trimmed[0].correct = true;
  return trimmed;
}

async function load() {
  exam.value = (await db.exams.get(examId.value)) ?? null;
  questions.value = await db.examQuestions.where("examId").equals(examId.value).toArray();
  questions.value = questions.value.sort((a, b) => a.prompt.localeCompare(b.prompt));

  examTitle.value = exam.value?.title ?? "";
  durationMinutes.value = exam.value?.durationSeconds ? Math.round(exam.value.durationSeconds / 60) : 10;
}

async function saveExam() {
  if (!exam.value) return;
  const t = examTitle.value.trim();
  if (!t) return set("danger", "Titre requis.");
  const minutes = Math.max(0, Math.floor(durationMinutes.value || 0));
  await db.exams.put({
    ...exam.value,
    title: t,
    durationSeconds: minutes ? minutes * 60 : undefined
  });
  set("ok", "Exam mis à jour ✅");
  await load();
}

function addChoice() {
  choices.value.push({ id: uid("c"), text: "", correct: false });
}
function removeChoice(idx: number) {
  if (choices.value.length <= 2) return;
  choices.value.splice(idx, 1);
}
function setCorrect(idx: number) {
  choices.value = choices.value.map((c, i) => ({ ...c, correct: i === idx }));
}

async function addQuestion() {
  if (!exam.value) return;
  const p = prompt.value.trim();
  if (!p) return set("danger", "Prompt requis.");
  const list = normalizeChoices(choices.value);
  if (list.length < 2) return set("danger", "Au moins 2 choix requis.");

  const q: ExamQuestion = {
    id: `${examId.value}:${uid("q")}`,
    examId: examId.value,
    prompt: p,
    choices: list.map((c) => ({ id: c.id, text: c.text, correct: !!c.correct })),
    explanation: explanation.value.trim() || undefined,
    tags: parseTags(tagsText.value)
  };
  await db.examQuestions.add(q);

  prompt.value = "";
  explanation.value = "";
  tagsText.value = "";
  choices.value = [
    { id: uid("c"), text: "", correct: true },
    { id: uid("c"), text: "", correct: false }
  ];
  set("ok", "Question ajoutée ✅");
  await load();
}

function openEdit(q: ExamQuestion) {
  editQId.value = q.id;
  editPrompt.value = q.prompt;
  editExplanation.value = q.explanation ?? "";
  editTagsText.value = (q.tags ?? []).join(", ");
  editChoices.value = q.choices.map((c) => ({ id: c.id, text: c.text, correct: !!c.correct }));
  editOpen.value = true;
}

function addEditChoice() {
  editChoices.value.push({ id: uid("c"), text: "", correct: false });
}
function removeEditChoice(idx: number) {
  if (editChoices.value.length <= 2) return;
  editChoices.value.splice(idx, 1);
}
function setEditCorrect(idx: number) {
  editChoices.value = editChoices.value.map((c, i) => ({ ...c, correct: i === idx }));
}

async function saveEdit() {
  if (!editQId.value) return;
  const p = editPrompt.value.trim();
  if (!p) return set("danger", "Prompt requis.");
  const list = normalizeChoices(editChoices.value);
  if (list.length < 2) return set("danger", "Au moins 2 choix requis.");

  await db.examQuestions.put({
    id: editQId.value,
    examId: examId.value,
    prompt: p,
    choices: list.map((c) => ({ id: c.id, text: c.text, correct: !!c.correct })),
    explanation: editExplanation.value.trim() || undefined,
    tags: parseTags(editTagsText.value)
  });
  editOpen.value = false;
  set("ok", "Question mise à jour ✅");
  await load();
}

async function removeQuestion(id: string) {
  if (!confirm("Supprimer cette question ?")) return;
  await db.examQuestions.delete(id);
  set("ok", "Question supprimée ✅");
  await load();
}

async function goBack() {
  await router.push("/qcm");
}

onMounted(load);
</script>

<template>
  <div v-if="!exam">
    <EmptyState title="Exam introuvable" hint="Retourne à la liste des exams." />
    <div class="row" style="margin-top:12px">
      <button class="btn" @click="goBack">Retour</button>
    </div>
  </div>

  <div v-else class="grid cols-2">
    <div class="card">
      <h2>Éditer exam</h2>

      <label class="small">Titre</label>
      <input class="input" v-model="examTitle" />

      <label class="small" style="margin-top:8px; display:block">Durée (minutes, optionnel)</label>
      <input class="input" type="number" min="0" v-model.number="durationMinutes" />

      <div class="row" style="margin-top:12px">
        <button class="btn" @click="saveExam">Enregistrer</button>
        <button class="btn" @click="goBack">Retour</button>
      </div>

      <div class="hr"></div>

      <h3>Ajouter une question</h3>
      <label class="small">Question</label>
      <textarea class="input" style="min-height:90px; resize:vertical" v-model="prompt" placeholder="Prompt…"></textarea>

      <label class="small" style="margin-top:8px; display:block">Explication (optionnel)</label>
      <textarea class="input" style="min-height:60px; resize:vertical" v-model="explanation" placeholder="Pourquoi…"></textarea>

      <label class="small" style="margin-top:8px; display:block">Tags (virgules)</label>
      <input class="input" v-model="tagsText" placeholder="negation, grammaire" />

      <div class="hr"></div>

      <h3>Choix</h3>
      <div class="list">
        <div v-for="(c, i) in choices" :key="c.id" class="card" style="margin:0">
          <div class="row" style="align-items:flex-start">
            <input type="radio" :checked="c.correct" @change="setCorrect(i)" />
            <input class="input" v-model="c.text" placeholder="Texte du choix" />
            <button class="btn" @click="removeChoice(i)" :disabled="choices.length <= 2">-</button>
          </div>
        </div>
      </div>
      <div class="row" style="margin-top:10px">
        <button class="btn" @click="addChoice">Ajouter un choix</button>
        <button class="btn ok" @click="addQuestion">Ajouter la question</button>
      </div>

      <div v-if="msg" style="margin-top:12px">
        <ConfirmBar :message="msg.text" :kind="msg.kind" />
      </div>
    </div>

    <div>
      <h2>Questions ({{ questions.length }})</h2>
      <div v-if="questions.length === 0">
        <EmptyState title="Aucune question" hint="Ajoute ta première question à gauche." />
      </div>

      <div v-else class="list">
        <div v-for="q in questions" :key="q.id" class="card">
          <div class="row">
            <div>
              <h3 style="margin:0">{{ q.prompt }}</h3>
              <p class="small" style="margin:4px 0 0 0">{{ (q.tags ?? []).join(", ") }}</p>
            </div>
            <div class="row" style="gap:8px">
              <button class="btn" @click="openEdit(q)">Éditer</button>
              <button class="btn danger" @click="removeQuestion(q.id)">Supprimer</button>
            </div>
          </div>
          <p class="small" style="margin-top:8px">
            Réponse: {{ q.choices.find(c => c.correct)?.text ?? "?" }}
          </p>
        </div>
      </div>
    </div>
  </div>

  <BaseModal :open="editOpen" title="Modifier une question" @close="editOpen = false">
    <div class="card" style="margin:0">
      <label class="small">Question</label>
      <textarea class="input" style="min-height:90px; resize:vertical" v-model="editPrompt"></textarea>

      <label class="small" style="margin-top:8px; display:block">Explication (optionnel)</label>
      <textarea class="input" style="min-height:60px; resize:vertical" v-model="editExplanation"></textarea>

      <label class="small" style="margin-top:8px; display:block">Tags (virgules)</label>
      <input class="input" v-model="editTagsText" />

      <div class="hr"></div>

      <h3>Choix</h3>
      <div class="list">
        <div v-for="(c, i) in editChoices" :key="c.id" class="card" style="margin:0">
          <div class="row" style="align-items:flex-start">
            <input type="radio" :checked="c.correct" @change="setEditCorrect(i)" />
            <input class="input" v-model="c.text" />
            <button class="btn" @click="removeEditChoice(i)" :disabled="editChoices.length <= 2">-</button>
          </div>
        </div>
      </div>
      <div class="row" style="margin-top:10px">
        <button class="btn" @click="addEditChoice">Ajouter un choix</button>
        <button class="btn" @click="saveEdit">Enregistrer</button>
        <button class="btn" @click="editOpen = false">Annuler</button>
      </div>
    </div>
  </BaseModal>
</template>