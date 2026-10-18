<script setup lang="ts">
import { parseTags } from "../services/tags";
import { confirmDialog } from "../services/dialog";
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { db, type Exam, type ExamQuestion } from "../db";
import { uid } from "../utils/id";
import { t } from "../i18n";
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
  const name = examTitle.value.trim();
  if (!name) return set("danger", t("qcm.titleRequired"));
  const minutes = Math.max(0, Math.floor(durationMinutes.value || 0));
  await db.exams.put({
    ...exam.value,
    title: name,
    durationSeconds: minutes ? minutes * 60 : undefined
  });
  set("ok", t("qcm.edit.updated"));
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
  if (!p) return set("danger", t("qcm.edit.promptRequired"));
  const list = normalizeChoices(choices.value);
  if (list.length < 2) return set("danger", t("qcm.edit.twoChoicesRequired"));

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
  set("ok", t("qcm.edit.questionAdded"));
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
  if (!p) return set("danger", t("qcm.edit.promptRequired"));
  const list = normalizeChoices(editChoices.value);
  if (list.length < 2) return set("danger", t("qcm.edit.twoChoicesRequired"));

  await db.examQuestions.put({
    id: editQId.value,
    examId: examId.value,
    prompt: p,
    choices: list.map((c) => ({ id: c.id, text: c.text, correct: !!c.correct })),
    explanation: editExplanation.value.trim() || undefined,
    tags: parseTags(editTagsText.value)
  });
  editOpen.value = false;
  set("ok", t("qcm.edit.questionUpdated"));
  await load();
}

async function removeQuestion(id: string) {
  if (!(await confirmDialog(t("qcm.edit.questionDeleteConfirm")))) return;
  await db.examQuestions.delete(id);
  set("ok", t("qcm.edit.questionDeleted"));
  await load();
}

async function goBack() {
  await router.push("/qcm");
}

onMounted(load);
</script>

<template>
  <div v-if="!exam">
    <EmptyState :title="$t('qcm.edit.notFound')" :hint="$t('qcm.edit.notFoundHint')" />
    <div class="row" style="margin-top:12px">
      <button class="btn" @click="goBack">{{ $t("common.back") }}</button>
    </div>
  </div>

  <!-- ✅ Pas de scroll global : chaque colonne gère son propre scroll -->
  <div v-else class="editGrid">
    <div class="card cardFill">
      <div class="scrollY">
      <h2>{{ $t("qcm.edit.heading") }}</h2>

      <label class="small">{{ $t("common.title") }}</label>
      <input class="input" v-model="examTitle" />

      <label class="small" style="margin-top:8px; display:block">{{ $t("qcm.durationLabel") }}</label>
      <input class="input" type="number" min="0" v-model.number="durationMinutes" />

      <div class="row" style="margin-top:12px">
        <button class="btn" @click="saveExam">{{ $t("common.save") }}</button>
        <button class="btn" @click="goBack">{{ $t("common.back") }}</button>
      </div>

      <div class="hr"></div>

      <h3>{{ $t("qcm.edit.addQuestion") }}</h3>
      <label class="small">{{ $t("qcm.edit.question") }}</label>
      <textarea class="input" style="min-height:90px; resize:vertical" v-model="prompt" :placeholder="$t('qcm.edit.promptPlaceholder')"></textarea>

      <label class="small" style="margin-top:8px; display:block">{{ $t("qcm.edit.explanation") }}</label>
      <textarea class="input" style="min-height:60px; resize:vertical" v-model="explanation" :placeholder="$t('qcm.edit.explanationPlaceholder')"></textarea>

      <label class="small" style="margin-top:8px; display:block">{{ $t("qcm.edit.tags") }}</label>
      <input class="input" v-model="tagsText" :placeholder="$t('qcm.edit.tagsPlaceholder')" />

      <div class="hr"></div>

      <h3>{{ $t("qcm.edit.choices") }}</h3>
      <div class="list">
        <div v-for="(c, i) in choices" :key="c.id" class="card" style="margin:0">
          <div class="row" style="align-items:flex-start">
            <input type="radio" :checked="c.correct" @change="setCorrect(i)" />
            <input class="input" v-model="c.text" :placeholder="$t('qcm.edit.choicePlaceholder')" />
            <button class="btn" @click="removeChoice(i)" :disabled="choices.length <= 2">-</button>
          </div>
        </div>
      </div>
      <div class="row" style="margin-top:10px">
        <button class="btn" @click="addChoice">{{ $t("qcm.edit.addChoice") }}</button>
        <button class="btn ok" @click="addQuestion">{{ $t("qcm.edit.addQuestionButton") }}</button>
      </div>

      <div v-if="msg" style="margin-top:12px">
        <ConfirmBar :message="msg.text" :kind="msg.kind" />
      </div>
      </div>
    </div>

    <div class="card cardFill">
      <div class="row flex-none mb-2.5">
        <h2 class="m-0">{{ $t("qcm.edit.questions") }}</h2>
        <span class="small">{{ questions.length }}</span>
      </div>

      <div v-if="questions.length === 0" class="flex-1 min-h-0 flex items-center justify-center">
        <EmptyState :title="$t('qcm.edit.emptyTitle')" :hint="$t('qcm.edit.emptyHint')" />
      </div>

      <div v-else class="scrollY">
        <div class="list">
          <div v-for="q in questions" :key="q.id" class="card">
            <div class="row">
              <div>
                <h3 class="m-0">{{ q.prompt }}</h3>
                <p class="small mt-1">{{ (q.tags ?? []).join(", ") }}</p>
              </div>
              <div class="row" style="gap:8px">
                <button class="btn" @click="openEdit(q)">{{ $t("common.edit") }}</button>
                <button class="btn danger" @click="removeQuestion(q.id)">{{ $t("common.delete") }}</button>
              </div>
            </div>
            <p class="small mt-2">
              {{ $t("qcm.edit.answer", { answer: q.choices.find(c => c.correct)?.text ?? "?" }) }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <BaseModal :open="editOpen" :title="$t('qcm.edit.editModal')" @close="editOpen = false">
    <div class="card" style="margin:0">
      <label class="small">{{ $t("qcm.edit.question") }}</label>
      <textarea class="input" style="min-height:90px; resize:vertical" v-model="editPrompt"></textarea>

      <label class="small" style="margin-top:8px; display:block">{{ $t("qcm.edit.explanation") }}</label>
      <textarea class="input" style="min-height:60px; resize:vertical" v-model="editExplanation"></textarea>

      <label class="small" style="margin-top:8px; display:block">{{ $t("qcm.edit.tags") }}</label>
      <input class="input" v-model="editTagsText" />

      <div class="hr"></div>

      <h3>{{ $t("qcm.edit.choices") }}</h3>
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
        <button class="btn" @click="addEditChoice">{{ $t("qcm.edit.addChoice") }}</button>
        <button class="btn" @click="saveEdit">{{ $t("common.save") }}</button>
        <button class="btn" @click="editOpen = false">{{ $t("common.cancel") }}</button>
      </div>
    </div>
  </BaseModal>
</template>