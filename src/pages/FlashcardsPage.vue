<script setup lang="ts">
import { computed, onMounted, ref, toRaw } from "vue";
import { useRoute, useRouter } from "vue-router";
import { db, type VocabDeck, type VocabItem, type AttemptDetail } from "../db";
import EmptyState from "../components/EmptyState.vue";
import BaseModal from "../components/BaseModal.vue";
import ProgressBar from "../components/ProgressBar.vue";
import ConfirmModal from "../components/ConfirmModal.vue";
import { uid } from "../utils/id";
import { clamp01 } from "../utils/time";
import { shuffle } from "../utils/shuffle";
import { useToast } from "../composables/useToast";
import { recordReview } from "../services/srs";

const toast = useToast();

const props = defineProps<{ deckId?: string }>();

const route = useRoute();
const router = useRouter();
const deckId = computed(() => props.deckId ?? String(route.params.deckId));

type FlashDirection = "term-to-def" | "def-to-term" | "random";

const deck = ref<VocabDeck | null>(null);
const items = ref<VocabItem[]>([]);
const idx = ref(0);
const flipped = ref(false);
const direction = ref<FlashDirection>("term-to-def");
/** Per-card direction when mode is "random" */
const cardDirections = ref<boolean[]>([]);

/** true = show term first (term→def), false = show def first (def→term) */
function isTermFirst(index: number): boolean {
  if (direction.value === "term-to-def") return true;
  if (direction.value === "def-to-term") return false;
  return cardDirections.value[index] ?? true;
}

const frontText = computed(() => {
  const c = current.value;
  if (!c) return "";
  return isTermFirst(idx.value) ? c.term : c.definition;
});

const backText = computed(() => {
  const c = current.value;
  if (!c) return "";
  return isTermFirst(idx.value) ? c.definition : c.term;
});

const correct = ref(0);
const total = ref(0);
const startedAt = ref(Date.now());

const showResultModal = ref(false);
const showFinishConfirm = ref(false);
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

  // mélange Fisher-Yates (non biaisé)
  items.value = shuffle(items.value);

  // Pre-generate random directions for each card
  cardDirections.value = items.value.map(() => Math.random() > 0.5);

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

  // SRS: record review (grade 1 = fail, grade 4 = success)
  await recordReview(c.id, "vocab", known ? 4 : 1).catch(() => {});

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
    toast.error("Erreur lors de l'enregistrement des résultats.");
  }
}

async function backToDeck() {
  await router.push(`/deck/${deckId.value}`);
}

async function restart() {
  showResultModal.value = false;
  savedAttempt.value = false;
  await load();
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
        <div class="row" style="gap:6px">
          <select class="input" style="width:auto; min-height:40px; padding:4px 8px; font-size:13px" v-model="direction">
            <option value="term-to-def">Terme → Déf</option>
            <option value="def-to-term">Déf → Terme</option>
            <option value="random">Aléatoire</option>
          </select>
          <router-link class="btn" :to="`/deck/${deckId}`">Retour</router-link>
        </div>
      </div>

      <ProgressBar :current="idx + 1" :total="items.length" />

      <div class="sessionBody flex flex-col justify-center mt-3">
        <div
            class="flashcard card cursor-pointer select-none text-center p-6 rounded-[20px] overflow-auto"
            :class="{ 'flashcard-flipped': flipped }"
            @click="flipped = !flipped"
        >
          <div class="small mb-2.5">{{ flipped ? "Réponse" : "Question" }} (clique pour retourner)</div>

          <div class="text-2xl font-extrabold">
            {{ flipped ? backText : frontText }}
          </div>
        </div>
      </div>

      <div class="sessionFooter">
        <div class="row mt-3">
          <button class="btn danger" @click="mark(false)">Je ne sais pas</button>
          <button class="btn ok" @click="mark(true)">Je sais</button>
          <button class="btn" @click="showFinishConfirm = true">Terminer</button>
        </div>

        <p class="small mt-2.5">
          Score session: {{ percent() }} ({{ correct }}/{{ total }})
        </p>
      </div>
    </div>

    <ConfirmModal
      :open="showFinishConfirm"
      title="Terminer les flashcards ?"
      message="Tu n'as pas fini toutes les cartes. Terminer maintenant ?"
      confirm-text="Terminer"
      @confirm="showFinishConfirm = false; finish()"
      @cancel="showFinishConfirm = false"
    />

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
          <button class="btn primary" @click="restart">🔄 Recommencer</button>
          <router-link class="btn" to="/stats">Voir les stats</router-link>
          <button class="btn" @click="backToDeck">Retour deck</button>
        </div>
      </div>
    </BaseModal>
  </div>
</template>

<style scoped>
.flashcard {
  transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.3s ease;
}
.flashcard:hover {
  box-shadow: 0 6px 24px rgb(0 0 0 / 0.25);
}
.flashcard:active {
  transform: scale(0.98);
}
.flashcard-flipped {
  animation: flip-in 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}
@keyframes flip-in {
  0% { transform: rotateY(90deg) scale(0.95); opacity: 0.5; }
  100% { transform: rotateY(0deg) scale(1); opacity: 1; }
}
</style>
