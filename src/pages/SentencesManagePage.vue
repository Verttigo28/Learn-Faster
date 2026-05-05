<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { db, type SentenceExercise } from "../db";
import { uid } from "../utils/id";
import { tokenizeSentence } from "../utils/sentence";
import EmptyState from "../components/EmptyState.vue";
import ConfirmBar from "../components/ConfirmBar.vue";
import BaseModal from "../components/BaseModal.vue";
import ConfirmModal from "../components/ConfirmModal.vue";
import { useToast } from "../composables/useToast";

const toast = useToast();

const all = ref<SentenceExercise[]>([]);
const text = ref("");
const translation = ref("");
const tagsText = ref("spok, vacances");
const message = ref<{ kind: "info" | "ok" | "danger"; text: string } | null>(null);
const search = ref("");
const pendingDeleteId = ref<string | null>(null);

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return all.value;
  return all.value.filter(s =>
    s.text.toLowerCase().includes(q) ||
    (s.translation ?? "").toLowerCase().includes(q) ||
    (s.tags ?? []).some(t => t.toLowerCase().includes(q))
  );
});

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

async function remove() {
  const id = pendingDeleteId.value;
  pendingDeleteId.value = null;
  if (!id) return;
  await db.sentenceExercises.delete(id);
  toast.success("Phrase supprimée !");
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
    </div>

    <div class="card cardFill">
      <div class="row flex-none mb-2.5">
        <h2 class="m-0">Liste des phrases</h2>
        <span class="small">{{ filtered.length }} / {{ all.length }}</span>
      </div>

      <input class="input mb-2.5" v-model="search" placeholder="🔍 Rechercher une phrase ou un tag…" />

      <div v-if="filtered.length === 0" class="flex-1 min-h-0 flex items-center justify-center">
        <EmptyState title="Aucune phrase" hint="Ajoute ta première phrase à gauche." />
      </div>

      <div v-else class="scrollY">
        <div class="list">
          <div v-for="s in filtered" :key="s.id" class="card">
            <div class="row">
              <div>
                <h3 class="m-0">{{ s.text }}</h3>
                <p v-if="s.translation" class="small mt-1">🇫🇷 Traduction : {{ s.translation }}</p>
                <p class="small mt-1">
                  {{ (s.tags ?? []).join(", ") }}
                </p>
              </div>
              <div class="row" style="gap:8px">
                <button class="btn" @click="openEdit(s)">Modifier</button>
                <button class="btn danger" @click="pendingDeleteId = s.id">Supprimer</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <ConfirmModal
      :open="!!pendingDeleteId"
      title="Supprimer la phrase"
      message="Supprimer cette phrase ? Cette action est irréversible."
      confirm-text="Supprimer"
      :danger="true"
      @confirm="remove"
      @cancel="pendingDeleteId = null"
    />
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
