<script setup lang="ts">
import { toast } from "../services/dialog";
import { useSessionGuard } from "../composables/useSessionGuard";
import { computed, onMounted, onUnmounted, ref, toRaw, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { db, type VocabDeck, type AttemptDetail } from "../db";
import EmptyState from "../components/EmptyState.vue";
import BaseModal from "../components/BaseModal.vue";
import { uid } from "../utils/id";
import { clamp01 } from "../utils/time";
import { shuffle } from "../utils/shuffle";
import {
  buildReviewQueue,
  formatInterval,
  newReview,
  saveReview,
  schedule,
  cardId,
  type Direction,
  type Grade,
  type QueueCard
} from "../services/srs";
import { speak, speechSupported } from "../services/speech";
import { getSetting, setSetting } from "../services/settings";

/**
 * Flashcards avec répétition espacée (SM-2).
 * - /deck/:deckId/flash          : toutes les cartes du deck (mélangées)
 * - /deck/:deckId/flash?mode=due : seulement les cartes à réviser du deck
 * - /review                      : révision du jour, tous decks confondus
 * Options: ?dir=reverse (définition -> terme)
 */
const props = defineProps<{ deckId?: string }>();

const route = useRoute();
const router = useRouter();
const deckId = computed(() => props.deckId ?? (route.params.deckId ? String(route.params.deckId) : undefined));
const reviewMode = computed(() => !deckId.value || route.query.mode === "due");
const direction = computed<Direction>(() => (route.query.dir === "reverse" ? "reverse" : "forward"));

const deck = ref<VocabDeck | null>(null);
const decks = ref<Record<string, VocabDeck>>({});
const queue = ref<QueueCard[]>([]);
const sessionSize = ref(0);
const loaded = ref(false);
const flipped = ref(false);

const correct = ref(0);
const total = ref(0);
const startedAt = ref(Date.now());

const showResultModal = ref(false);
const savedAttempt = ref(false);

/** ✅ Détails question par question (pour page résultat + PDF) — première réponse par carte */
const details = ref<AttemptDetail[]>([]);
const seen = new Set<string>();

const current = computed(() => queue.value[0]);
const front = computed(() => {
  const it = current.value?.item;
  if (!it) return "";
  return direction.value === "forward" ? it.term : it.definition;
});
const back = computed(() => {
  const it = current.value?.item;
  if (!it) return "";
  return direction.value === "forward" ? it.definition : it.term;
});

const canSpeak = speechSupported();
const autoSpeak = ref(false);

const currentDeck = computed(() => (current.value ? decks.value[current.value.item.deckId] : undefined));
const frontLang = computed(() => (direction.value === "forward" ? currentDeck.value?.from : currentDeck.value?.to));
const backLang = computed(() => (direction.value === "forward" ? currentDeck.value?.to : currentDeck.value?.from));

function say(side: "front" | "back") {
  if (side === "front") speak(front.value, frontLang.value);
  else speak(back.value, backLang.value);
}

async function toggleAutoSpeak() {
  autoSpeak.value = !autoSpeak.value;
  await setSetting("autoSpeak", autoSpeak.value);
  if (autoSpeak.value) say("front");
}

watch(
  () => current.value?.review.cardId,
  (id) => { if (id && autoSpeak.value && canSpeak) say("front"); }
);

const title = computed(() => {
  if (deck.value) return deck.value.title;
  return "Révision du jour";
});

const grades: { grade: Grade; label: string; cls: string; key: string }[] = [
  { grade: 0, label: "À revoir", cls: "danger", key: "1" },
  { grade: 1, label: "Difficile", cls: "", key: "2" },
  { grade: 2, label: "Bien", cls: "ok", key: "3" },
  { grade: 3, label: "Facile", cls: "primary", key: "4" }
];

const previews = computed(() => {
  const c = current.value;
  if (!c) return {} as Record<Grade, string>;
  const now = Date.now();
  return Object.fromEntries(
    grades.map((g) => [g.grade, formatInterval(schedule(c.review, g.grade, now), now)])
  ) as Record<Grade, string>;
});

function percent() {
  return total.value ? `${Math.round((correct.value / total.value) * 100)}%` : "0%";
}

async function load() {
  loaded.value = false;
  deck.value = deckId.value ? ((await db.vocabDecks.get(deckId.value)) ?? null) : null;
  decks.value = Object.fromEntries((await db.vocabDecks.toArray()).map((d) => [d.id, d]));

  if (reviewMode.value) {
    queue.value = await buildReviewQueue({ deckId: deckId.value, direction: direction.value });
  } else if (deckId.value) {
    const items = await db.vocabItems.where("deckId").equals(deckId.value).toArray();
    const reviews = await db.reviews.bulkGet(items.map((it) => cardId(it.id, direction.value)));
    queue.value = shuffle(
      items.map((item, i) => ({
        item,
        review: reviews[i] ?? newReview(item, direction.value),
        isNew: !reviews[i]
      }))
    );
  }

  autoSpeak.value = await getSetting("autoSpeak");
  sessionSize.value = queue.value.length;
  flipped.value = false;
  correct.value = 0;
  total.value = 0;
  startedAt.value = Date.now();
  details.value = [];
  seen.clear();
  showResultModal.value = false;
  savedAttempt.value = false;
  loaded.value = true;
}

async function grade(g: Grade) {
  const c = current.value;
  if (!c || !flipped.value) return;

  const next = schedule(c.review, g);
  try {
    await saveReview(toRaw(next));
  } catch (e) {
    console.error("SRS save failed:", e);
    toast("Erreur lors de l'enregistrement de la révision.", "danger");
  }

  if (!seen.has(c.review.cardId)) {
    seen.add(c.review.cardId);
    total.value += 1;
    const known = g > 0;
    if (known) correct.value += 1;
    details.value.push({
      kind: "flashcard",
      id: c.item.id,
      term: front.value,
      definition: back.value,
      known,
      correct: known
    });
  }

  queue.value.shift();
  // "À revoir" en mode révision : la carte revient en fin de session.
  if (g === 0 && reviewMode.value) queue.value.push({ ...c, review: next, isNew: false });
  flipped.value = false;

  if (queue.value.length === 0) await finish();
}

async function finish() {
  if (showResultModal.value) return;

  showResultModal.value = true;

  const score = total.value === 0 ? 0 : correct.value / total.value;
  const durationSeconds = Math.floor((Date.now() - startedAt.value) / 1000);

  // déjà sauvegardé, ou rien révisé
  if (savedAttempt.value || total.value === 0) return;

  try {
    const plainDetails = toRaw(details.value).map(d => ({ ...d }));
    await db.attempts.add({
      id: uid("att"),
      type: "flashcards",
      refId: deckId.value ?? "review",
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
    toast("Erreur lors de l'enregistrement des résultats (IndexedDB).", "danger");
  }
}

async function backToDeck() {
  await router.push(deckId.value ? `/deck/${deckId.value}` : "/");
}

function onKeydown(e: KeyboardEvent) {
  if (showResultModal.value || !current.value) return;
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  if (e.key === " " || e.key === "Enter") {
    e.preventDefault();
    flipped.value = !flipped.value;
    return;
  }
  const g = grades.find((x) => x.key === e.key);
  if (g && flipped.value) grade(g.grade);
}

useSessionGuard(() => !showResultModal.value && total.value > 0);

onMounted(() => {
  window.addEventListener("keydown", onKeydown);
  load();
});
onUnmounted(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <div class="sessionPage">
    <div v-if="!loaded" class="card sessionCard"></div>

    <div v-else-if="deckId && !deck" class="card sessionCard">
      <EmptyState title="Deck introuvable" />
    </div>

    <div v-else-if="sessionSize === 0" class="card sessionCard">
      <EmptyState
        :title="reviewMode ? 'Rien à réviser 🎉' : 'Deck vide'"
        :hint="reviewMode ? 'Toutes les cartes sont à jour. Reviens demain !' : 'Importe des items dans ce deck.'"
      />
      <div class="row mt-3">
        <router-link v-if="deckId" class="btn" :to="`/deck/${deckId}/flash`">Réviser tout le deck</router-link>
        <router-link class="btn" to="/">Accueil</router-link>
      </div>
    </div>

    <div v-else class="sessionCard">
      <div class="row">
        <div>
          <h2 class="m-0">{{ reviewMode ? "Révision" : "Flashcards" }}</h2>
          <p class="small mt-1">
            {{ title }} • {{ queue.length }} restante(s)
            <span v-if="direction === 'reverse'"> • sens inverse</span>
          </p>
        </div>
        <div class="row">
          <button v-if="canSpeak" class="btn" :class="{ primary: autoSpeak }" @click="toggleAutoSpeak">🔊 Auto {{ autoSpeak ? "on" : "off" }}</button>
          <router-link class="btn" :to="deckId ? `/deck/${deckId}` : '/'">Retour</router-link>
        </div>
      </div>

      <div class="hr"></div>

      <div class="sessionBody flex flex-col justify-center">
        <div
            class="card cursor-pointer select-none text-center p-6 rounded-[20px] overflow-auto"
            @click="flipped = !flipped"
        >
          <div class="small mb-2.5">
            <span v-if="current?.isNew" class="badge mr-2">Nouvelle</span>
            <span v-if="!deck && current" class="badge mr-2">{{ decks[current.item.deckId]?.title }}</span>
            {{ flipped ? "Réponse" : "Question" }} (clique ou Espace pour retourner)
          </div>

          <div class="text-2xl font-extrabold">
            {{ front }}
            <button v-if="canSpeak" class="btn ml-2" type="button" title="Écouter" @click.stop="say('front')">🔊</button>
          </div>
          <template v-if="flipped">
            <div class="hr"></div>
            <div class="text-2xl font-extrabold text-accent">
              {{ back }}
              <button v-if="canSpeak" class="btn ml-2" type="button" title="Écouter" @click.stop="say('back')">🔊</button>
            </div>
          </template>
        </div>
      </div>

      <div class="sessionFooter">
        <div v-if="!flipped" class="row mt-3">
          <button class="btn primary flex-1" @click="flipped = true">Afficher la réponse</button>
          <button class="btn" @click="finish">Terminer</button>
        </div>
        <div v-else class="grid grid-cols-2 tablet:grid-cols-4 gap-2 mt-3">
          <button
            v-for="g in grades"
            :key="g.grade"
            class="btn flex-col gap-1 py-3"
            :class="g.cls"
            @click="grade(g.grade)"
          >
            <span>{{ g.label }}</span>
            <span class="small">{{ previews[g.grade] }} · {{ g.key }}</span>
          </button>
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
            <div class="small">Cartes revues</div>
            <div class="kpi">{{ correct }}/{{ total }}</div>
          </div>
        </div>

        <div class="hr"></div>

        <div class="row">
          <router-link class="btn" to="/stats">Voir les stats</router-link>
          <button class="btn" @click="backToDeck">{{ deckId ? "Retour deck" : "Accueil" }}</button>
        </div>
      </div>
    </BaseModal>
  </div>
</template>
