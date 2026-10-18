<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import { getAllTags } from "../services/tags";
import { speechSupported } from "../services/speech";
import ConfirmBar from "../components/ConfirmBar.vue";
import { useRouter } from "vue-router";
import { db } from "../db";
import { normalizeAnswer } from "../utils/answer";
import { t } from "../i18n";

const router = useRouter();

const tags = ref<string[]>([]);
const selected = ref<string[]>([]);
const count = ref<number>(20);
const tagQuery = ref("");

const includeVocab = ref(true);
const includeExam = ref(true);
const includeOrder = ref(true);
const includeTyped = ref(false);
const includeCloze = ref(false);
const includeDictation = ref(false);
const vocabDir = ref<"forward" | "reverse" | "both">("forward");
const canSpeak = speechSupported();

/** Tags of every row, per table (for the live "matching items" count). */
const rowTags = ref<{ vocab: string[][]; exam: string[][]; sentences: string[][] } | null>(null);

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

function clearTags() {
  selected.value = [];
}

/** Quick level chips: only for levels that exist as tags (case-insensitive). */
const LEVELS = ["a1", "a2", "b1"];
const levelTags = computed(() =>
  LEVELS.map((lvl) => ({ lvl, tag: tags.value.find((x) => x.toLowerCase() === lvl) })).filter(
    (x): x is { lvl: string; tag: string } => !!x.tag
  )
);

const filteredTags = computed(() => {
  const q = normalizeAnswer(tagQuery.value);
  return tags.value.filter((tag) => !selected.value.includes(tag) && (!q || normalizeAnswer(tag).includes(q)));
});

/** Items that the current sources + tags can draw from (same rule as buildPractice: any selected tag). */
const matchingCount = computed(() => {
  const rows = rowTags.value;
  if (!rows) return null;
  const sel = new Set(selected.value);
  const match = (list: string[][]) => (sel.size ? list.filter((tg) => tg.some((x) => sel.has(x))).length : list.length);
  const useVocab = includeVocab.value || includeTyped.value || includeDictation.value;
  const useSentences = includeOrder.value || includeCloze.value;
  return (useVocab ? match(rows.vocab) : 0) + (includeExam.value ? match(rows.exam) : 0) + (useSentences ? match(rows.sentences) : 0);
});

async function load() {
  tags.value = await getAllTags();
  try {
    const [v, e, s] = await Promise.all([db.vocabItems.toArray(), db.examQuestions.toArray(), db.sentenceExercises.toArray()]);
    rowTags.value = {
      vocab: v.map((x) => x.tags ?? []),
      exam: e.map((x) => x.tags ?? []),
      sentences: s.map((x) => x.tags ?? [])
    };
  } catch (err) {
    console.error(err);
  }
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
  <div class="genPage">
    <header class="genHead">
      <div class="min-w-0">
        <h1>{{ $t("generator.title") }}</h1>
        <p class="small m-0">{{ $t("generator.intro") }}</p>
      </div>
      <div class="genActions">
        <router-link class="btn ghost" to="/vocab">{{ $t("generator.editVocab") }}</router-link>
        <router-link class="btn ghost" to="/qcm">{{ $t("generator.editQcm") }}</router-link>
      </div>
    </header>

    <div class="genGrid">
      <section class="card genSection">
        <h2>{{ $t("generator.sources") }}</h2>
        <div class="sourceGrid">
          <label class="sourceOpt" :class="{ on: includeVocab }"><input type="checkbox" v-model="includeVocab" /> {{ $t("generator.source.vocab") }}</label>
          <label class="sourceOpt" :class="{ on: includeExam }"><input type="checkbox" v-model="includeExam" /> {{ $t("generator.source.exam") }}</label>
          <label class="sourceOpt" :class="{ on: includeOrder }"><input type="checkbox" v-model="includeOrder" /> {{ $t("generator.source.order") }}</label>
          <label class="sourceOpt" :class="{ on: includeTyped }"><input type="checkbox" v-model="includeTyped" /> {{ $t("generator.source.typed") }}</label>
          <label class="sourceOpt" :class="{ on: includeCloze }"><input type="checkbox" v-model="includeCloze" /> {{ $t("generator.source.cloze") }}</label>
          <label v-if="canSpeak" class="sourceOpt" :class="{ on: includeDictation }"><input type="checkbox" v-model="includeDictation" /> {{ $t("generator.source.dictation") }}</label>
        </div>

        <div class="hr"></div>

        <div class="settingsRow">
          <label class="field">
            <span class="small">{{ $t("generator.vocabDirection") }}</span>
            <select class="input" v-model="vocabDir">
              <option value="forward">{{ $t("generator.direction.forward") }}</option>
              <option value="reverse">{{ $t("generator.direction.reverse") }}</option>
              <option value="both">{{ $t("generator.direction.both") }}</option>
            </select>
          </label>
          <label class="field countField">
            <span class="small">{{ $t("generator.count") }}</span>
            <input class="input" type="number" min="1" max="200" v-model.number="count" />
          </label>
        </div>
      </section>

      <section class="card genSection tagsSection">
        <div class="sectionHead">
          <h2>{{ $t("generator.tags") }}</h2>
          <span v-if="matchingCount !== null" class="badge accent" aria-live="polite">
            {{ $t("generator.matching", { count: matchingCount }) }}
          </span>
        </div>
        <p class="small m-0">{{ $t("generator.tagsHint") }}</p>

        <div class="tagTools">
          <input
            v-model="tagQuery"
            class="input"
            type="search"
            :placeholder="$t('generator.tagSearch')"
            :aria-label="$t('generator.tagSearch')"
          />
          <div v-if="levelTags.length" class="pills levelChips" role="group" :aria-label="$t('generator.levels')">
            <button
              v-for="l in levelTags"
              :key="l.lvl"
              type="button"
              class="pill chip"
              :class="{ active: selected.includes(l.tag) }"
              :aria-pressed="selected.includes(l.tag)"
              @click="toggleTag(l.tag)"
            >
              {{ l.lvl.toUpperCase() }}
            </button>
          </div>
        </div>

        <div v-if="selected.length" class="selectedRow">
          <span class="small">{{ $t("generator.selected", { count: selected.length }) }}</span>
          <div class="pills">
            <button v-for="tag in selected" :key="tag" type="button" class="pill active" :aria-pressed="true" @click="toggleTag(tag)">
              {{ tag }} ×
            </button>
          </div>
          <button type="button" class="btn ghost clearBtn" @click="clearTags">{{ $t("generator.clear") }}</button>
        </div>

        <div class="tagBox genTagBox">
          <div v-if="filteredTags.length" class="pills">
            <button
              v-for="tag in filteredTags"
              :key="tag"
              class="pill chip"
              :aria-pressed="false"
              @click="toggleTag(tag)"
              type="button"
            >
              {{ tag }}
            </button>
          </div>
          <p v-else class="small m-0">{{ tags.length ? $t("generator.noTagMatch") : $t("generator.noTags") }}</p>
        </div>
      </section>
    </div>

    <div v-if="msg">
      <ConfirmBar :message="msg.text" :kind="msg.kind" />
    </div>

    <div class="genFooter">
      <button class="btn primary lg" @click="start">{{ $t("generator.start") }}</button>
    </div>
  </div>
</template>

<style scoped>
.genPage {
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  max-width: 1100px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-right: 4px;
}
.genHead {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8px 16px;
}
.genActions { display: flex; gap: 4px; flex-wrap: wrap; }
.genGrid {
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
}
@media (min-width: 768px) {
  .genGrid { grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr); }
}
.sourceGrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 6px;
  margin-top: 6px;
}
.sourceOpt {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid rgb(var(--border) / .12);
  background: rgb(var(--sunken) / .3);
  cursor: pointer;
  font-size: 14px;
}
.sourceOpt.on { border-color: rgb(var(--accent) / .7); }
.sourceOpt input { accent-color: rgb(var(--accent)); }
.settingsRow {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.field { display: flex; flex-direction: column; gap: 4px; flex: 1 1 180px; }
.countField { flex: 0 1 140px; }
.tagTools {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-top: 10px;
}
.tagTools .input { flex: 1 1 180px; width: auto; }
.levelChips { flex-wrap: nowrap; }
.selectedRow {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  margin-top: 10px;
}
.clearBtn { padding: 4px 8px; }
.genTagBox { max-height: clamp(160px, 34vh, 360px); }
.genFooter {
  display: flex;
  justify-content: flex-end;
  padding-bottom: 8px;
}
@media (max-width: 767px) {
  .genFooter .btn { width: 100%; }
}
</style>
