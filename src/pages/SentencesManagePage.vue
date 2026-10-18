<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { db, type SentenceDeck, type SentenceExercise } from "../db";
import { tokenizeSentence } from "../utils/sentence";
import { parseTags } from "../services/tags";
import { addSentence, removeSentenceDeck } from "../services/sentences";
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
  const t = text.value.trim();
  if (!t) return set("danger", "Écris une phrase.");
  if (tokenizeSentence(t).length < 2) return set("danger", "Phrase trop courte (au moins 2 mots).");

  await addSentence({
    deckTitle: deckTitle.value,
    text: t,
    translation: translation.value,
    tags: parseTags(tagsText.value)
  });

  text.value = "";
  translation.value = "";
  set("ok", "Phrase ajoutée ✅");
  await load();
}

async function remove(id: string) {
  if (!confirm("Supprimer cette phrase ?")) return;
  await db.sentenceExercises.delete(id);
  await load();
}

async function removeDeck() {
  const id = deckFilter.value;
  if (!id) return;
  if (!confirm(`Supprimer le deck « ${deckTitles.value[id]} » et toutes ses phrases ?`)) return;
  await removeSentenceDeck(id);
  deckFilter.value = "";
  set("ok", "Deck supprimé ✅");
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
  const t = editText.value.trim();
  if (!t) return set("danger", "Écris une phrase.");
  const tokens = tokenizeSentence(t);
  if (tokens.length < 2) return set("danger", "Phrase trop courte (au moins 2 mots).");

  const tr = editTranslation.value.trim();
  await db.sentenceExercises.update(editId.value, {
    text: t,
    translation: tr || undefined,
    tags: parseTags(editTagsText.value),
    tokens
  });

  editOpen.value = false;
  editId.value = null;
  set("ok", "Phrase modifiée ✅");
  await load();
}

onMounted(load);
</script>

<template>
  <!-- ✅ Pas de scroll global : liste des phrases scrollable à droite -->
  <div class="manageGrid">
    <div class="card cardFill">
      <div class="scrollY">
      <h2>Phrases — ordre des mots (SPOK)</h2>
      <p>Crée des phrases en indonésien. L’exercice les mélange et tu dois les remettre dans le bon ordre.</p>

      <label class="small">Deck (choisis ou tape un nouveau nom)</label>
      <input class="input" v-model="deckTitle" list="sentenceDeckTitles" placeholder="Mes phrases" />
      <datalist id="sentenceDeckTitles">
        <option v-for="d in decks" :key="d.id" :value="d.title" />
      </datalist>

      <label class="small" style="margin-top:8px; display:block">Phrase (indonésien)</label>
      <input class="input" v-model="text" placeholder="ex: Aku liburan ke Indonesia" />

      <label class="small" style="margin-top:8px; display:block">Traduction (français)</label>
      <input class="input" v-model="translation" placeholder="ex: Je pars en vacances en Indonésie" />

      <label class="small" style="margin-top:8px; display:block">Tags (séparés par des virgules)</label>
      <input class="input" v-model="tagsText" placeholder="spok, vacances, grammaire" />

      <div class="row" style="margin-top:12px">
        <button class="btn" @click="add">Ajouter</button>
        <router-link class="btn" to="/exams">Se lancer dans un exam</router-link>
      </div>

      <div style="margin-top:12px" v-if="message">
        <ConfirmBar :message="message.text" :kind="message.kind" />
      </div>

      </div>
    </div>

    <div class="card cardFill">
      <div class="row flex-none mb-2.5">
        <h2 class="m-0">Liste des phrases</h2>
        <span class="small">{{ shown.length }}</span>
      </div>

      <div v-if="decks.length" class="row flex-none mb-2.5 flex-nowrap">
        <select class="input" v-model="deckFilter">
          <option value="">Tous les decks</option>
          <option v-for="d in decks" :key="d.id" :value="d.id">{{ d.title }}</option>
        </select>
        <button v-if="deckFilter" class="btn danger" @click="removeDeck">Supprimer le deck</button>
      </div>

      <div v-if="shown.length === 0" class="flex-1 min-h-0 flex items-center justify-center">
        <EmptyState title="Aucune phrase" hint="Ajoute ta première phrase à gauche." />
      </div>

      <div v-else class="scrollY">
        <div class="list">
          <div v-for="s in shown" :key="s.id" class="card">
            <div class="row">
              <div>
                <h3 class="m-0">{{ s.text }}</h3>
                <p v-if="s.translation" class="small mt-1">🇫🇷 Traduction : {{ s.translation }}</p>
                <p class="small mt-1">
                  <span class="badge">{{ deckTitles[s.deckId] ?? s.deckId }}</span>
                  {{ (s.tags ?? []).join(", ") }}
                </p>
              </div>
              <div class="row" style="gap:8px">
                <button class="btn" @click="openEdit(s)">Modifier</button>
                <button class="btn danger" @click="remove(s.id)">Supprimer</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <BaseModal :open="editOpen" title="Modifier la phrase" @close="editOpen = false">
    <div class="card" style="margin:0">
      <label class="small">Phrase (indonésien)</label>
      <input class="input" v-model="editText" />

      <label class="small" style="margin-top:8px; display:block">Traduction (français)</label>
      <input class="input" v-model="editTranslation" />

      <label class="small" style="margin-top:8px; display:block">Tags (séparés par des virgules)</label>
      <input class="input" v-model="editTagsText" />

      <div class="row" style="margin-top:12px">
        <button class="btn" @click="saveEdit">Enregistrer</button>
        <button class="btn" @click="editOpen = false">Annuler</button>
      </div>
    </div>
  </BaseModal>
</template>
