<script setup lang="ts">
import { useSessionGuard } from "../composables/useSessionGuard";
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { db, type VocabDeck, type VocabItem } from "../db";
import EmptyState from "../components/EmptyState.vue";
import BaseModal from "../components/BaseModal.vue";
import { buildVocabQuestion } from "../services/vocabQuiz";
import { uid } from "../utils/id";
import { clamp01 } from "../utils/time";
import { shuffle } from "../utils/shuffle";

const props = defineProps<{ deckId?: string }>();

const route = useRoute();
const router = useRouter();
const deckId = computed(() => props.deckId ?? String(route.params.deckId));
const deck = ref<VocabDeck | null>(null);
const items = ref<VocabItem[]>([]);
const order = ref<VocabItem[]>([]);
const idx = ref(0);

const selected = ref<string | null>(null);
const locked = ref(false);

const correct = ref(0);
const answered = ref(0);
const startedAt = ref(Date.now());

const showResultModal = ref(false);
const savedAttempt = ref(false);

const question = computed(() => {
  const item = order.value[idx.value];
  if (!item) return null;
  return buildVocabQuestion(items.value, item, Math.min(4, Math.max(2, items.value.length)));
});

function percent() {
  return answered.value ? `${Math.round((correct.value / answered.value) * 100)}%` : "0%";
}

async function load() {
  deck.value = (await db.vocabDecks.get(deckId.value)) ?? null;
  items.value = await db.vocabItems.where("deckId").equals(deckId.value).toArray();

  order.value = shuffle(items.value);

  idx.value = 0;
  selected.value = null;
  locked.value = false;
  correct.value = 0;
  answered.value = 0;
  startedAt.value = Date.now();

  showResultModal.value = false;
  savedAttempt.value = false;
}

function choose(optId: string) {
  if (locked.value) return;
  selected.value = optId;
}

function submit() {
  if (!question.value || !selected.value || locked.value) return;
  locked.value = true;
  answered.value += 1;

  const isCorrect = question.value.options.find((o) => o.id === selected.value)?.correct === true;
  if (isCorrect) correct.value += 1;
}

function next() {
  if (!locked.value) return;
  selected.value = null;
  locked.value = false;
  idx.value += 1;

  if (idx.value >= order.value.length) finish();
}

async function finish() {
  if (showResultModal.value) return;

  showResultModal.value = true;
  const score = answered.value === 0 ? 0 : correct.value / answered.value;

  if (!savedAttempt.value) {
    savedAttempt.value = true;
    await db.attempts.add({
      id: uid("att"),
      type: "vocab_quiz",
      refId: deckId.value,
      startedAt: startedAt.value,
      finishedAt: Date.now(),
      score: clamp01(score),
      meta: { total: answered.value, correct: correct.value }
    });
  }
}

async function backToDeck() {
  await router.push(`/deck/${deckId.value}`);
}

useSessionGuard(() => !showResultModal.value && answered.value > 0);

onMounted(load);
</script>

<template>
  <div v-if="!deck" class="page flex items-center justify-center">
    <EmptyState title="Deck introuvable" />
  </div>

  <div v-else-if="items.length < 2" class="page flex items-center justify-center">
    <EmptyState title="Pas assez d'items" hint="Ajoute au moins 2 items pour faire un quiz." />
  </div>

  <!-- ✅ Page plein écran sans scroll global, contenu scrollable dans le body -->
  <div v-else-if="question" class="sessionPage">
    <div class="sessionCard">
      <div class="row">
        <div>
          <h2 style="margin:0">Quiz (QCM)</h2>
          <p class="small" style="margin:4px 0 0 0">{{ deck.title }} • {{ idx + 1 }} / {{ order.length }}</p>
        </div>
        <router-link class="btn" :to="`/deck/${deckId}`">Retour</router-link>
      </div>

      <div class="hr"></div>

      <div class="sessionBody">
        <h3>{{ question.prompt }}</h3>
        <div class="list">
          <button
            v-for="o in question.options"
            :key="o.id"
            class="btn"
            :class="{
              primary: selected === o.id && !locked,
              ok: locked && o.correct,
              danger: locked && selected === o.id && !o.correct
            }"
            style="text-align:left"
            @click="choose(o.id)"
          >
            {{ o.text }}
          </button>
        </div>

        <p class="small" style="margin-top:10px">
          Score: {{ percent() }} ({{ correct }}/{{ answered }})
        </p>
      </div>

      <div class="sessionFooter row">
        <button class="btn" @click="submit" :disabled="!selected || locked">Valider</button>
        <button class="btn" @click="next" :disabled="!locked">Suivant</button>
        <button class="btn ok" @click="finish">Terminer</button>
      </div>
    </div>
  </div>

  <BaseModal :open="showResultModal" title="Résultat du quiz" @close="backToDeck">
    <div class="card" style="margin:0">
      <div class="row">
        <div>
          <div class="small">Score</div>
          <div class="kpi">{{ percent() }}</div>
        </div>
        <div>
          <div class="small">Bonnes réponses</div>
          <div class="kpi">{{ correct }}/{{ answered }}</div>
        </div>
      </div>

      <div class="hr"></div>

      <div class="row">
        <router-link class="btn" to="/stats">Voir les stats</router-link>
        <button class="btn" @click="backToDeck">Retour deck</button>
      </div>
    </div>
  </BaseModal>
</template>
