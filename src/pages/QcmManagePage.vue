<script setup lang="ts">
import { confirmDialog } from "../services/dialog";
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { db, type Exam } from "../db";
import { uid } from "../utils/id";
import { t } from "../i18n";
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
  const name = title.value.trim();
  if (!name) return set("danger", t("qcm.titleRequired"));

  const minutes = Math.max(0, Math.floor(durationMinutes.value || 0));

  const exam: Exam = {
    id: uid("exam"),
    title: name,
    durationSeconds: minutes ? minutes * 60 : undefined,
    createdAt: Date.now()
  };
  await db.exams.add(exam);
  title.value = "";
  set("ok", t("qcm.manage.created"));
  await load();
}

async function removeExam(id: string) {
  if (!(await confirmDialog(t("qcm.manage.deleteConfirm")))) return;
  await db.transaction("rw", [db.exams, db.examQuestions], async () => {
    await db.exams.delete(id);
    await db.examQuestions.where("examId").equals(id).delete();
  });
  set("ok", t("qcm.manage.deleted"));
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
      <h2>{{ $t("qcm.manage.heading") }}</h2>
      <p class="small">{{ $t("qcm.manage.intro") }}</p>

      <div class="hr"></div>

      <h3>{{ $t("qcm.manage.newExam") }}</h3>
      <label class="small">{{ $t("common.title") }}</label>
      <input class="input" v-model="title" :placeholder="$t('qcm.manage.titlePlaceholder')" />

      <label class="small" style="margin-top:8px; display:block">{{ $t("qcm.durationLabel") }}</label>
      <input class="input" type="number" min="0" v-model.number="durationMinutes" />

      <div class="row" style="margin-top:12px">
        <button class="btn" @click="createExam">{{ $t("common.create") }}</button>
        <router-link class="btn" to="/exams">{{ $t("qcm.launchExam") }}</router-link>
      </div>

      <div v-if="msg" style="margin-top:12px">
        <ConfirmBar :message="msg.text" :kind="msg.kind" />
      </div>
      </div>
    </div>

    <div class="card cardFill">
      <div class="row flex-none mb-2.5">
        <h2 class="m-0">{{ $t("qcm.manage.listTitle") }}</h2>
        <span class="small">{{ exams.length }}</span>
      </div>

      <div v-if="exams.length === 0" class="flex-1 min-h-0 flex items-center justify-center">
        <EmptyState :title="$t('qcm.manage.emptyTitle')" :hint="$t('qcm.manage.emptyHint')" />
      </div>

      <div v-else class="scrollY">
        <div class="list">
          <div v-for="e in exams" :key="e.id" class="card">
            <div class="row">
              <div>
                <h3 class="m-0">{{ e.title }}</h3>
                <p class="small mt-1">
                  {{ $t("common.questions", { count: counts[e.id] ?? 0 }) }}
                  <span v-if="e.durationSeconds"> • {{ $t("qcm.manage.durationInfo", { n: Math.round(e.durationSeconds / 60) }) }}</span>
                </p>
              </div>
              <div class="row" style="gap:8px">
                <button class="btn" @click="editExam(e.id)">{{ $t("common.edit") }}</button>
                <button class="btn danger" @click="removeExam(e.id)">{{ $t("common.delete") }}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
