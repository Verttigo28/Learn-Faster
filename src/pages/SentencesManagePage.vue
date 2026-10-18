<script setup lang="ts">
import { confirmDialog } from "../services/dialog";
import { computed, onMounted, ref } from "vue";
import { db, type SentenceDeck, type SentenceExercise } from "../db";
import { tokenizeSentence } from "../utils/sentence";
import { parseTags } from "../services/tags";
import { addSentence, removeSentenceDeck } from "../services/sentences";
import { t } from "../i18n";
import EmptyState from "../components/EmptyState.vue";
import ConfirmBar from "../components/ConfirmBar.vue";
import BaseModal from "../components/BaseModal.vue";

const all = ref<SentenceExercise[]>([]);
const decks = ref<SentenceDeck[]>([]);
const deckFilter = ref<string>("");
const deckTitle = ref("");
const text = ref("");
const translation = ref("");
const tagsText = ref("spok, vacances");
const message = ref<{ kind: "info" | "ok" | "danger"; text: string } | null>(null);

// Edition (modal)
const editOpen = ref(false);
const editId = ref<string | null>(null);
const editText = ref("");
const editTranslation = ref("");
const editTagsText = ref("");

const deckTitles = computed(() => Object.fromEntries(decks.value.map((d) => [d.id, d.title])));
const shown = computed(() => (deckFilter.value ? all.value.filter((s) => s.deckId === deckFilter.value) : all.value));

function set(kind: "info" | "ok" | "danger", text: string) {
  message.value = { kind, text };
}

async function load() {
  decks.value = await db.sentenceDecks.orderBy("title").toArray();
  all.value = await db.sentenceExercises.orderBy("createdAt").reverse().toArray();
  if (deckFilter.value && !decks.value.some((d) => d.id === deckFilter.value)) deckFilter.value = "";
}

async function add() {
  const sentence = text.value.trim();
  if (!sentence) return set("danger", t("sentences.manage.writeSentence"));
  if (tokenizeSentence(sentence).length < 2) return set("danger", t("sentences.manage.tooShort"));

  await addSentence({
    deckTitle: deckTitle.value,
    text: sentence,
    translation: translation.value,
    tags: parseTags(tagsText.value)
  });

  text.value = "";
  translation.value = "";
  set("ok", t("sentences.manage.added"));
  await load();
}

async function remove(id: string) {
  if (!(await confirmDialog(t("sentences.manage.deleteConfirm")))) return;
  await db.sentenceExercises.delete(id);
  await load();
}

async function removeDeck() {
  const id = deckFilter.value;
  if (!id) return;
  if (!(await confirmDialog(t("sentences.manage.deleteDeckConfirm", { title: deckTitles.value[id] })))) return;
  await removeSentenceDeck(id);
  deckFilter.value = "";
  set("ok", t("sentences.manage.deckDeleted"));
  await load();
}

function openEdit(s: SentenceExercise) {
  editId.value = s.id;
  editText.value = s.text;
  editTranslation.value = s.translation ?? "";
  editTagsText.value = (s.tags ?? []).join(", ");
  editOpen.value = true;
}

async function saveEdit() {
  if (!editId.value) return;
  const sentence = editText.value.trim();
  if (!sentence) return set("danger", t("sentences.manage.writeSentence"));
  const tokens = tokenizeSentence(sentence);
  if (tokens.length < 2) return set("danger", t("sentences.manage.tooShort"));

  const tr = editTranslation.value.trim();
  await db.sentenceExercises.update(editId.value, {
    text: sentence,
    translation: tr || undefined,
    tags: parseTags(editTagsText.value),
    tokens
  });

  editOpen.value = false;
  editId.value = null;
  set("ok", t("sentences.manage.updated"));
  await load();
}

onMounted(load);
</script>

<template>
  <!-- ✅ Pas de scroll global : liste des phrases scrollable à droite -->
  <div class="manageGrid">
    <div class="card cardFill">
      <div class="scrollY">
      <h2>{{ $t("sentences.manage.heading") }}</h2>
      <p>{{ $t("sentences.manage.intro") }}</p>

      <label class="small">{{ $t("sentences.manage.deckLabel") }}</label>
      <input class="input" v-model="deckTitle" list="sentenceDeckTitles" :placeholder="$t('services.myPhrases')" />
      <datalist id="sentenceDeckTitles">
        <option v-for="d in decks" :key="d.id" :value="d.title" />
      </datalist>

      <label class="small" style="margin-top:8px; display:block">{{ $t("sentences.manage.sentenceLabel") }}</label>
      <input class="input" v-model="text" :placeholder="$t('sentences.manage.sentencePlaceholder')" />

      <label class="small" style="margin-top:8px; display:block">{{ $t("sentences.manage.translationLabel") }}</label>
      <input class="input" v-model="translation" :placeholder="$t('sentences.manage.translationPlaceholder')" />

      <label class="small" style="margin-top:8px; display:block">{{ $t("common.tags") }}</label>
      <input class="input" v-model="tagsText" :placeholder="$t('sentences.manage.tagsPlaceholder')" />

      <div class="row" style="margin-top:12px">
        <button class="btn" @click="add">{{ $t("common.add") }}</button>
        <router-link class="btn" to="/exams">{{ $t("sentences.manage.launchExam") }}</router-link>
      </div>

      <div style="margin-top:12px" v-if="message">
        <ConfirmBar :message="message.text" :kind="message.kind" />
      </div>

      </div>
    </div>

    <div class="card cardFill">
      <div class="row flex-none mb-2.5">
        <h2 class="m-0">{{ $t("sentences.manage.listTitle") }}</h2>
        <span class="small">{{ shown.length }}</span>
      </div>

      <div v-if="decks.length" class="row flex-none mb-2.5 flex-nowrap">
        <select class="input" v-model="deckFilter">
          <option value="">{{ $t("sentences.manage.allDecks") }}</option>
          <option v-for="d in decks" :key="d.id" :value="d.id">{{ d.title }}</option>
        </select>
        <button v-if="deckFilter" class="btn danger" @click="removeDeck">{{ $t("sentences.manage.deleteDeck") }}</button>
      </div>

      <div v-if="shown.length === 0" class="flex-1 min-h-0 flex items-center justify-center">
        <EmptyState :title="$t('sentences.manage.emptyTitle')" :hint="$t('sentences.manage.emptyHint')" />
      </div>

      <div v-else class="scrollY">
        <div class="list">
          <div v-for="s in shown" :key="s.id" class="card">
            <div class="row">
              <div>
                <h3 class="m-0">{{ s.text }}</h3>
                <p v-if="s.translation" class="small mt-1">{{ $t("sentences.manage.translation", { text: s.translation }) }}</p>
                <p class="small mt-1">
                  <span class="badge">{{ deckTitles[s.deckId] ?? s.deckId }}</span>
                  {{ (s.tags ?? []).join(", ") }}
                </p>
              </div>
              <div class="row" style="gap:8px">
                <button class="btn" @click="openEdit(s)">{{ $t("sentences.manage.editButton") }}</button>
                <button class="btn danger" @click="remove(s.id)">{{ $t("common.delete") }}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <BaseModal :open="editOpen" :title="$t('sentences.manage.editModal')" @close="editOpen = false">
    <div class="card" style="margin:0">
      <label class="small">{{ $t("sentences.manage.sentenceLabel") }}</label>
      <input class="input" v-model="editText" />

      <label class="small" style="margin-top:8px; display:block">{{ $t("sentences.manage.translationLabel") }}</label>
      <input class="input" v-model="editTranslation" />

      <label class="small" style="margin-top:8px; display:block">{{ $t("common.tags") }}</label>
      <input class="input" v-model="editTagsText" />

      <div class="row" style="margin-top:12px">
        <button class="btn" @click="saveEdit">{{ $t("common.save") }}</button>
        <button class="btn" @click="editOpen = false">{{ $t("common.cancel") }}</button>
      </div>
    </div>
  </BaseModal>
</template>
