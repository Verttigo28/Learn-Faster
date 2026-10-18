<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import { getAllTags } from "../services/tags";
import { speechSupported } from "../services/speech";
import ConfirmBar from "../components/ConfirmBar.vue";
import { useRouter } from "vue-router";
import { t } from "../i18n";

const router = useRouter();

const tags = ref<string[]>([]);
const selected = ref<string[]>([]);
const count = ref<number>(20);

const includeVocab = ref(true);
const includeExam = ref(true);
const includeOrder = ref(true);
const includeTyped = ref(false);
const includeCloze = ref(false);
const includeDictation = ref(false);
const vocabDir = ref<"forward" | "reverse" | "both">("forward");
const canSpeak = speechSupported();

const msg = ref<{ kind: "info" | "ok" | "danger"; text: string } | null>(null);
function set(kind: "info" | "ok" | "danger", text: string) {
  msg.value = { kind, text };
}

const sources = computed(() => {
  const s: string[] = [];
  if (includeVocab.value) s.push("vocab");
  if (includeExam.value) s.push("exam");
  if (includeOrder.value) s.push("order");
  if (includeTyped.value) s.push("typed");
  if (includeCloze.value) s.push("cloze");
  if (includeDictation.value) s.push("dictation");
  return s;
});

function toggleTag(tag: string) {
  const i = selected.value.indexOf(tag);
  if (i >= 0) selected.value.splice(i, 1);
  else selected.value.push(tag);
}

async function load() {
  tags.value = await getAllTags();
}

async function start() {
  if (sources.value.length === 0) return set("danger", t("generator.noSource"));
  const q = new URLSearchParams();
  q.set("count", String(Math.max(1, Math.min(200, count.value || 20))));
  q.set("sources", sources.value.join(","));
  if (vocabDir.value !== "forward") q.set("dir", vocabDir.value);
  if (selected.value.length) q.set("tags", selected.value.join(","));
  await router.push(`/practice?${q.toString()}`);
}

onMounted(load);
</script>

<template>
  <div class="examsOne">
    <div class="card modalWide">
      <h2>{{ $t("generator.title") }}</h2>
      <p>{{ $t("generator.intro") }}</p>

      <div class="hr"></div>

      <h3>{{ $t("generator.sources") }}</h3>
      <div class="row" style="flex-wrap:wrap">
        <label class="badge"><input type="checkbox" v-model="includeVocab" /> {{ $t("generator.source.vocab") }}</label>
        <label class="badge"><input type="checkbox" v-model="includeExam" /> {{ $t("generator.source.exam") }}</label>
        <label class="badge"><input type="checkbox" v-model="includeOrder" /> {{ $t("generator.source.order") }}</label>
        <label class="badge"><input type="checkbox" v-model="includeTyped" /> {{ $t("generator.source.typed") }}</label>
        <label class="badge"><input type="checkbox" v-model="includeCloze" /> {{ $t("generator.source.cloze") }}</label>
        <label v-if="canSpeak" class="badge"><input type="checkbox" v-model="includeDictation" /> {{ $t("generator.source.dictation") }}</label>
      </div>

      <div class="row justify-start mt-2.5">
        <span class="small">{{ $t("generator.vocabDirection") }}</span>
        <select class="input w-auto" v-model="vocabDir">
          <option value="forward">{{ $t("generator.direction.forward") }}</option>
          <option value="reverse">{{ $t("generator.direction.reverse") }}</option>
          <option value="both">{{ $t("generator.direction.both") }}</option>
        </select>
      </div>

      <div class="hr"></div>

      <h3>{{ $t("generator.count") }}</h3>
      <input class="input" type="number" min="1" max="200" v-model.number="count" />

      <div class="hr"></div>

      <h3>{{ $t("generator.tags") }}</h3>
      <p class="small">{{ $t("generator.tagsHint") }}</p>

      <!-- ✅ Zone tags scrollable -->
      <div class="tagBox">
        <div class="pills" style="flex-wrap:wrap">
          <button
              v-for="tag in tags"
              :key="tag"
              class="pill"
              :class="{ active: selected.includes(tag) }"
              @click="toggleTag(tag)"
              type="button"
          >
            {{ tag }}
          </button>
        </div>
      </div>

      <div style="margin-top:12px" v-if="msg">
        <ConfirmBar :message="msg.text" :kind="msg.kind" />
      </div>

      <div class="hr"></div>

      <div class="row">
        <button class="btn" @click="start">{{ $t("generator.start") }}</button>
        <router-link class="btn" to="/vocab">{{ $t("generator.editVocab") }}</router-link>
        <router-link class="btn" to="/qcm">{{ $t("generator.editQcm") }}</router-link>
      </div>
    </div>
  </div>
</template>


