<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import { getAllTags } from "../services/tags";
import ConfirmBar from "../components/ConfirmBar.vue";
import { useRouter } from "vue-router";

const router = useRouter();

const tags = ref<string[]>([]);
const selected = ref<string[]>([]);
const count = ref<number>(20);

const includeVocab = ref(true);
const includeExam = ref(true);
const includeOrder = ref(true);

const msg = ref<{ kind: "info" | "ok" | "danger"; text: string } | null>(null);
function set(kind: "info" | "ok" | "danger", text: string) {
  msg.value = { kind, text };
}

const sources = computed(() => {
  const s: string[] = [];
  if (includeVocab.value) s.push("vocab");
  if (includeExam.value) s.push("exam");
  if (includeOrder.value) s.push("order");
  return s;
});

function toggleTag(t: string) {
  const i = selected.value.indexOf(t);
  if (i >= 0) selected.value.splice(i, 1);
  else selected.value.push(t);
}

async function load() {
  tags.value = await getAllTags();
}

async function start() {
  if (sources.value.length === 0) return set("danger", "Choisis au moins une source (Vocab / QCM / Ordre des mots).");
  const q = new URLSearchParams();
  q.set("count", String(Math.max(1, Math.min(200, count.value || 20))));
  q.set("sources", sources.value.join(","));
  if (selected.value.length) q.set("tags", selected.value.join(","));
  await router.push(`/practice?${q.toString()}`);
}

onMounted(load);
</script>

<template>
  <div class="examsOne">
    <div class="card modalWide">
      <h2>Générateur d'exam</h2>
      <p>Une base commune : vocab + QCM + phrases (ordre des mots). Tu filtres par tags, et l'app construit l'exam.</p>

      <div class="hr"></div>

      <h3>Sources</h3>
      <div class="row flex-wrap">
        <label class="badge cursor-pointer"><input type="checkbox" v-model="includeVocab" /> Vocab (QCM généré)</label>
        <label class="badge cursor-pointer"><input type="checkbox" v-model="includeExam" /> QCM (importés)</label>
        <label class="badge cursor-pointer"><input type="checkbox" v-model="includeOrder" /> Ordre des mots (SPOK)</label>
      </div>

      <div class="hr"></div>

      <h3>Nombre de questions</h3>
      <input class="input" type="number" min="1" max="200" v-model.number="count" />

      <div class="hr"></div>

      <h3>Tags</h3>
      <p class="small">Si tu ne sélectionnes aucun tag, l’exam utilisera tout le contenu disponible.</p>

      <!-- ✅ Zone tags scrollable -->
      <div class="tagBox">
        <div class="pills flex-wrap">
          <button
              v-for="t in tags"
              :key="t"
              class="pill"
              :class="{ active: selected.includes(t) }"
              @click="toggleTag(t)"
              type="button"
          >
            {{ t }}
          </button>
        </div>
      </div>

      <div class="mt-3" v-if="msg">
        <ConfirmBar :message="msg.text" :kind="msg.kind" />
      </div>

      <div class="hr"></div>

      <div class="row">
        <button class="btn" @click="start">Démarrer l’exam</button>
        <router-link class="btn" to="/vocab">Éditer vocab</router-link>
        <router-link class="btn" to="/qcm">Éditer QCM</router-link>
      </div>
    </div>
  </div>
</template>


