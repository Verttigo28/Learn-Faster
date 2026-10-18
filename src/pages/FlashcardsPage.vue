<script setup lang="ts">
import { computed, onMounted, ref, toRaw } from "vue";
import { useRoute, useRouter } from "vue-router";
import { db, type VocabDeck, type VocabItem, type AttemptDetail } from "../db";
import EmptyState from "../components/EmptyState.vue";
import BaseModal from "../components/BaseModal.vue";
import { uid } from "../utils/id";
import { clamp01 } from "../utils/time";
import { shuffle } from "../utils/shuffle";

const props = defineProps<{ deckId?: string }>();

const route = useRoute();
const router = useRouter();
const deckId = computed(() => props.deckId ?? String(route.params.deckId));

const deck = ref<VocabDeck | null>(null);
const items = ref<VocabItem[]>([]);
const idx = ref(0);
const flipped = ref(false);

const correct = ref(0);
const total = ref(0);
const startedAt = ref(Date.now());

const showResultModal = ref(false);
const savedAttempt = ref(false);

/** ✅ Détails question par question (pour page résultat + PDF) */
const details = ref<AttemptDetail[]>([]);

const current = computed(() => items.value[idx.value]);

function percent() {
  return total.value ? `${Math.round((correct.value / total.value) * 100)}%` : "0%";
}

async function load() {
  deck.value = (await db.vocabDecks.get(deckId.value)) ?? null;
  items.value = await db.vocabItems.where("deckId").equals(deckId.value).toArray();

  // mélange simple
  items.value = shuffle(items.value);

  idx.value = 0;
  flipped.value = false;
  correct.value = 0;
  total.value = 0;
  startedAt.value = Date.now();

  details.value = [];

  showResultModal.value = false;
  savedAttempt.value = false;
}

async function next() {
  flipped.value = false;
  idx.value += 1;

  if (idx.value >= items.value.length) {
    await finish(); // ✅ on attend la sauvegarde
  }
}

async function mark(known: boolean) {
  const c = current.value;
  if (!c) return;

  total.value += 1;
  if (known) correct.value += 1;

  // ✅ enregistre le détail (permet d'afficher un résultat non vide)
  details.value.push({
    kind: "flashcard",
    id: c.id,
    term: c.term,
    definition: c.definition,
    known,
    correct: known
  });

  await next();
}

async function finish() {
  if (showResultModal.value) return;

  showResultModal.value = true;

  const score = total.value === 0 ? 0 : correct.value / total.value;
  const durationSeconds = Math.floor((Date.now() - startedAt.value) / 1000);

  // déjà sauvegardé
  if (savedAttempt.value) return;

  try {
    const plainDetails = toRaw(details.value).map(d => ({ ...d }));
    await db.attempts.add({
      id: uid("att"),
      type: "flashcards",
      refId: deckId.value,
      startedAt: startedAt.value,
      finishedAt: Date.now(),
      score: clamp01(score),
      meta: {
        total: total.value,
        correct: correct.value,
        durationSeconds,
        details: plainDetails
      }
    });

    savedAttempt.value = true;
  } catch (e) {
    console.error("Flashcards save failed:", e);
    savedAttempt.value = false;
    alert("Erreur lors de l'enregistrement des résultats (IndexedDB).");
  }
}

async function backToDeck() {
  await router.push(`/deck/${deckId.value}`);
}

onMounted(load);
</script>

<template>
  <div class="sessionPage">
    <div v-if="!deck" class="card sessionCard">
      <EmptyState title="Deck introuvable" />
    </div>

    <div v-else-if="items.length === 0" class="card sessionCard">
      <EmptyState title="Deck vide" hint="Importe des items dans ce deck." />
    </div>

    <div v-else class="sessionCard">
      <div class="row">
        <div>
          <h2 class="m-0">Flashcards</h2>
          <p class="small mt-1">{{ deck.title }} • {{ Math.min(idx + 1, items.length) }} / {{ items.length }}</p>
        </div>
        <router-link class="btn" :to="`/deck/${deckId}`">Retour</router-link>
      </div>

      <div class="hr"></div>

      <div class="sessionBody flex flex-col justify-center">
        <div
            class="card cursor-pointer select-none text-center p-6 rounded-[20px] overflow-auto"
            @click="flipped = !flipped"
        >
          <div class="small mb-2.5">{{ flipped ? "Réponse" : "Question" }} (clique pour retourner)</div>

          <div class="text-2xl font-extrabold">
            {{ flipped ? current?.definition : current?.term }}
          </div>
        </div>
      </div>

      <div class="sessionFooter">
        <div class="row mt-3">
          <button class="btn danger" @click="mark(false)">Je ne sais pas</button>
          <button class="btn ok" @click="mark(true)">Je sais</button>
          <button class="btn" @click="finish">Terminer</button>
        </div>

        <p class="small mt-2.5">
          Score session: {{ percent() }} ({{ correct }}/{{ total }})
        </p>
      </div>
    </div>

    <BaseModal :open="showResultModal" title="Résultat flashcards" @close="backToDeck">
      <div class="card" style="margin:0">
        <div class="row">
          <div>
            <div class="small">Score</div>
            <div class="kpi">{{ percent() }}</div>
          </div>
          <div>
            <div class="small">Bonnes réponses</div>
            <div class="kpi">{{ correct }}/{{ total }}</div>
          </div>
        </div>

        <div class="hr"></div>

        <div class="row">
          <router-link class="btn" to="/stats">Voir les stats</router-link>
          <button class="btn" @click="backToDeck">Retour deck</button>
        </div>
      </div>
    </BaseModal>
  </div>
</template>
