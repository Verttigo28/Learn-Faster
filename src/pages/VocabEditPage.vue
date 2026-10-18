<script setup lang="ts">
import { parseTags } from "../services/tags";
import { confirmDialog } from "../services/dialog";
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { db, type VocabDeck, type VocabItem } from "../db";
import { uid } from "../utils/id";
import { t } from "../i18n";
import EmptyState from "../components/EmptyState.vue";
import ConfirmBar from "../components/ConfirmBar.vue";
import BaseModal from "../components/BaseModal.vue";

const props = defineProps<{ deckId?: string }>();
const route = useRoute();
const router = useRouter();
const deckId = computed(() => props.deckId ?? String(route.params.deckId));

const deck = ref<VocabDeck | null>(null);
const items = ref<VocabItem[]>([]);
const msg = ref<{ kind: "info" | "ok" | "danger"; text: string } | null>(null);

const deckTitle = ref("");
const deckFrom = ref("");
const deckTo = ref("");

const term = ref("");
const definition = ref("");
const tagsText = ref("");

const editOpen = ref(false);
const editItemId = ref<string | null>(null);
const editTerm = ref("");
const editDefinition = ref("");
const editTagsText = ref("");

function set(kind: "info" | "ok" | "danger", text: string) {
  msg.value = { kind, text };
}


async function load() {
  deck.value = (await db.vocabDecks.get(deckId.value)) ?? null;
  items.value = await db.vocabItems.where("deckId").equals(deckId.value).toArray();
  items.value = items.value.sort((a, b) => a.term.localeCompare(b.term));

  deckTitle.value = deck.value?.title ?? "";
  deckFrom.value = deck.value?.from ?? "";
  deckTo.value = deck.value?.to ?? "";
}

async function saveDeck() {
  if (!deck.value) return;
  const name = deckTitle.value.trim();
  if (!name) return set("danger", t("vocab.titleRequired"));
  await db.vocabDecks.put({
    ...deck.value,
    title: name,
    from: (deckFrom.value || "id").trim(),
    to: (deckTo.value || "fr").trim()
  });
  set("ok", t("vocab.edit.updated"));
  await load();
}

async function addItem() {
  if (!deck.value) return;
  const tm = term.value.trim();
  const d = definition.value.trim();
  if (!tm || !d) return set("danger", t("vocab.edit.termDefinitionRequired"));

  const it: VocabItem = {
    id: `${deckId.value}:${uid("it")}`,
    deckId: deckId.value,
    term: tm,
    definition: d,
    tags: parseTags(tagsText.value)
  };
  await db.vocabItems.add(it);
  term.value = "";
  definition.value = "";
  tagsText.value = "";
  set("ok", t("vocab.edit.itemAdded"));
  await load();
}

function openEdit(it: VocabItem) {
  editItemId.value = it.id;
  editTerm.value = it.term;
  editDefinition.value = it.definition;
  editTagsText.value = (it.tags ?? []).join(", ");
  editOpen.value = true;
}

async function saveEdit() {
  if (!editItemId.value) return;
  const tm = editTerm.value.trim();
  const d = editDefinition.value.trim();
  if (!tm || !d) return set("danger", t("vocab.edit.termDefinitionRequired"));
  await db.vocabItems.put({
    id: editItemId.value,
    deckId: deckId.value,
    term: tm,
    definition: d,
    tags: parseTags(editTagsText.value)
  });
  editOpen.value = false;
  set("ok", t("vocab.edit.itemUpdated"));
  await load();
}

async function removeItem(id: string) {
  if (!(await confirmDialog(t("vocab.edit.itemDeleteConfirm")))) return;
  await db.transaction("rw", [db.vocabItems, db.reviews], async () => {
    await db.vocabItems.delete(id);
    await db.reviews.where("itemId").equals(id).delete();
  });
  set("ok", t("vocab.edit.itemDeleted"));
  await load();
}

async function goBack() {
  await router.push("/vocab");
}

onMounted(load);
</script>

<template>
  <div class="page">
    <div v-if="!deck">
      <EmptyState :title="$t('vocab.notFound')" :hint="$t('vocab.edit.notFoundHint')" />
      <div class="row mt-3">
        <button class="btn" @click="goBack">{{ $t("common.back") }}</button>
      </div>
    </div>

    <div v-else class="editGrid">
      <div class="card">
        <h2>{{ $t("vocab.edit.heading") }}</h2>

        <label class="small">{{ $t("common.title") }}</label>
        <input class="input" v-model="deckTitle" />

        <div class="row mt-2 gap-2.5">
          <div class="flex-1">
            <label class="small">{{ $t("common.from") }}</label>
            <input class="input" v-model="deckFrom" />
          </div>
          <div class="flex-1">
            <label class="small">{{ $t("common.to") }}</label>
            <input class="input" v-model="deckTo" />
          </div>
        </div>

        <div class="row mt-3">
          <button class="btn" @click="saveDeck">{{ $t("common.save") }}</button>
          <button class="btn" @click="goBack">{{ $t("common.back") }}</button>
        </div>

        <div class="hr"></div>

        <h3>{{ $t("vocab.edit.addItem") }}</h3>
        <label class="small">{{ $t("vocab.edit.term") }}</label>
        <input class="input" v-model="term" :placeholder="$t('vocab.edit.termPlaceholder')" />
        <label class="small mt-2 block">{{ $t("vocab.edit.definition") }}</label>
        <input class="input" v-model="definition" :placeholder="$t('vocab.edit.definitionPlaceholder')" />
        <label class="small mt-2 block">{{ $t("vocab.edit.tags") }}</label>
        <input class="input" v-model="tagsText" :placeholder="$t('vocab.edit.tagsPlaceholder')" />

        <div class="row mt-3">
          <button class="btn ok" @click="addItem">{{ $t("common.add") }}</button>
        </div>

        <div v-if="msg" class="mt-3">
          <ConfirmBar :message="msg.text" :kind="msg.kind" />
        </div>
      </div>

      <div class="card cardFill">
        <h2 class="m-0">{{ $t("vocab.edit.itemsCount", { count: items.length }) }}</h2>
        <div class="hr"></div>

        <div v-if="items.length === 0">
          <EmptyState :title="$t('vocab.edit.emptyTitle')" :hint="$t('vocab.edit.emptyHint')" />
        </div>

        <div v-else class="scrollY">
          <div class="list">
            <div v-for="it in items" :key="it.id" class="card">
            <div class="row">
              <div>
                <h3 class="m-0">{{ it.term }} → {{ it.definition }}</h3>
                <p class="small mt-1 mb-0">{{ (it.tags ?? []).join(", ") }}</p>
              </div>
              <div class="row gap-2">
                <button class="btn" @click="openEdit(it)">{{ $t("common.edit") }}</button>
                <button class="btn danger" @click="removeItem(it.id)">{{ $t("common.delete") }}</button>
              </div>
            </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <BaseModal :open="editOpen" :title="$t('vocab.edit.editModal')" @close="editOpen = false">
      <div class="card" style="margin:0">
        <label class="small">{{ $t("vocab.edit.term") }}</label>
        <input class="input" v-model="editTerm" />
        <label class="small mt-2 block">{{ $t("vocab.edit.definition") }}</label>
        <input class="input" v-model="editDefinition" />
        <label class="small mt-2 block">{{ $t("vocab.edit.tags") }}</label>
        <input class="input" v-model="editTagsText" />

        <div class="row mt-3">
          <button class="btn" @click="saveEdit">{{ $t("common.save") }}</button>
          <button class="btn" @click="editOpen = false">{{ $t("common.cancel") }}</button>
        </div>
      </div>
    </BaseModal>
  </div>
</template>
