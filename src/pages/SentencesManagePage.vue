<script setup lang="ts">
import { onMounted, ref } from "vue";
import { db, type SentenceExercise } from "../db";
import { uid } from "../utils/id";
import { tokenizeSentence } from "../utils/sentence";
import EmptyState from "../components/EmptyState.vue";
import ConfirmBar from "../components/ConfirmBar.vue";
import BaseModal from "../components/BaseModal.vue";

const all = ref<SentenceExercise[]>([]);
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

function set(kind: "info" | "ok" | "danger", text: string) {
  message.value = { kind, text };
}

function parseTags(input: string): string[] {
  return input
    .split(",")
    .map(t => t.trim())
    .filter(Boolean);
}

async function load() {
  all.value = await db.sentenceExercises.orderBy("createdAt").reverse().toArray();
}

async function add() {
  const t = text.value.trim();
  if (!t) return set("danger", "Écris une phrase.");
  const tokens = tokenizeSentence(t);
  if (tokens.length < 2) return set("danger", "Phrase trop courte (au moins 2 mots).");

  const tr = translation.value.trim();

  await db.sentenceExercises.add({
    id: uid("sent"),
    text: t,
    translation: tr || undefined,
    tokens,
    tags: parseTags(tagsText.value),
    createdAt: Date.now()
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
  <div class="grid cols-2">
    <div class="card">
      <h2>Phrases — ordre des mots (SPOK)</h2>
      <p>Crée des phrases en indonésien. L’exercice les mélange et tu dois les remettre dans le bon ordre.</p>

      <label class="small">Phrase (indonésien)</label>
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

    <div>
      <div v-if="all.length === 0">
        <EmptyState title="Aucune phrase" hint="Ajoute ta première phrase à gauche." />
      </div>

      <div v-else class="list">
        <div v-for="s in all" :key="s.id" class="card">
          <div class="row">
            <div>
              <h3 style="margin:0">{{ s.text }}</h3>
              <p v-if="s.translation" class="small" style="margin:4px 0 0 0">🇫🇷 Traduction : {{ s.translation }}</p>
              <p class="small" style="margin:4px 0 0 0">
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
<style scoped>
/* Le "modal" : hauteur max raisonnable, sans prendre 100% */
.grid{
  max-width: 1100px;
  margin: 0 auto;
  align-items: start;
}

/* Card gauche: ne s'étire pas */
.grid > .card{
  align-self: start;
}

/* Colonne droite: contient la liste, hauteur max "modal" */
.grid > div:nth-child(2){
  max-height: 720px;     /* <-- ajuste si tu veux 650/800 */
  overflow: hidden;
}

/* La liste scrolle dans la colonne droite */
.list{
  max-height: 720px;     /* même valeur que ci-dessus */
  overflow: auto;
  padding-right: 6px;
}
</style>
