<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { db, type VocabDeck, type VocabItem } from "../db";
import { uid } from "../utils/id";
import EmptyState from "../components/EmptyState.vue";
import ConfirmBar from "../components/ConfirmBar.vue";
import BaseModal from "../components/BaseModal.vue";
import ConfirmModal from "../components/ConfirmModal.vue";
import { useToast } from "../composables/useToast";

const toast = useToast();
const pendingDeleteId = ref<string | null>(null);

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

function parseTags(input: string): string[] {
  return input
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
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
  const t = deckTitle.value.trim();
  if (!t) return set("danger", "Titre requis.");
  await db.vocabDecks.put({
    ...deck.value,
    title: t,
    from: (deckFrom.value || "id").trim(),
    to: (deckTo.value || "fr").trim()
  });
  set("ok", "Deck mis à jour ✅");
  await load();
}

async function addItem() {
  if (!deck.value) return;
  const t = term.value.trim();
  const d = definition.value.trim();
  if (!t || !d) return set("danger", "Term et définition requis.");

  const it: VocabItem = {
    id: `${deckId.value}:${uid("it")}`,
    deckId: deckId.value,
    term: t,
    definition: d,
    tags: parseTags(tagsText.value)
  };
  await db.vocabItems.add(it);
  term.value = "";
  definition.value = "";
  tagsText.value = "";
  set("ok", "Item ajouté ✅");
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
  const t = editTerm.value.trim();
  const d = editDefinition.value.trim();
  if (!t || !d) return set("danger", "Term et définition requis.");
  await db.vocabItems.put({
    id: editItemId.value,
    deckId: deckId.value,
    term: t,
    definition: d,
    tags: parseTags(editTagsText.value)
  });
  editOpen.value = false;
  set("ok", "Item mis à jour ✅");
  await load();
}

async function removeItem() {
  const id = pendingDeleteId.value;
  pendingDeleteId.value = null;
  if (!id) return;
  await db.vocabItems.delete(id);
  toast.success("Item supprimé !");
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
      <EmptyState title="Deck introuvable" hint="Retourne à la liste des decks." />
      <div class="row mt-3">
        <button class="btn" @click="goBack">Retour</button>
      </div>
    </div>

    <div v-else class="editGrid">
      <div class="card">
        <h2>Éditer deck</h2>

        <label class="small">Titre</label>
        <input class="input" v-model="deckTitle" />

        <div class="row mt-2 gap-2.5">
          <div class="flex-1">
            <label class="small">De</label>
            <input class="input" v-model="deckFrom" />
          </div>
          <div class="flex-1">
            <label class="small">Vers</label>
            <input class="input" v-model="deckTo" />
          </div>
        </div>

        <div class="row mt-3">
          <button class="btn" @click="saveDeck">Enregistrer</button>
          <button class="btn" @click="goBack">Retour</button>
        </div>

        <div class="hr"></div>

        <h3>Ajouter un item</h3>
        <label class="small">Terme</label>
        <input class="input" v-model="term" placeholder="ex: makan" />
        <label class="small mt-2 block">Définition</label>
        <input class="input" v-model="definition" placeholder="ex: manger" />
        <label class="small mt-2 block">Tags (virgules)</label>
        <input class="input" v-model="tagsText" placeholder="vacances, verbe" />

        <div class="row mt-3">
          <button class="btn ok" @click="addItem">Ajouter</button>
        </div>

        <div v-if="msg" class="mt-3">
          <ConfirmBar :message="msg.text" :kind="msg.kind" />
        </div>
      </div>

      <div class="card cardFill">
        <h2 class="m-0">Items ({{ items.length }})</h2>
        <div class="hr"></div>

        <div v-if="items.length === 0">
          <EmptyState title="Aucun item" hint="Ajoute ton premier item à gauche." icon="✏️" />
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
                <button class="btn" @click="openEdit(it)">Éditer</button>
                <button class="btn danger" @click="pendingDeleteId = it.id">Supprimer</button>
              </div>
            </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <BaseModal :open="editOpen" title="Modifier un item" @close="editOpen = false">
      <div class="card" style="margin:0">
        <label class="small">Terme</label>
        <input class="input" v-model="editTerm" />
        <label class="small mt-2 block">Définition</label>
        <input class="input" v-model="editDefinition" />
        <label class="small mt-2 block">Tags (virgules)</label>
        <input class="input" v-model="editTagsText" />

        <div class="row mt-3">
          <button class="btn" @click="saveEdit">Enregistrer</button>
          <button class="btn" @click="editOpen = false">Annuler</button>
        </div>
      </div>
    </BaseModal>

    <ConfirmModal
      :open="!!pendingDeleteId"
      title="Supprimer l'item"
      message="Supprimer cet item de vocabulaire ?"
      confirm-text="Supprimer"
      :danger="true"
      @confirm="removeItem"
      @cancel="pendingDeleteId = null"
    />
  </div>
</template>
