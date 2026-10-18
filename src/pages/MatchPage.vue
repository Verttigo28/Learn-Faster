<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { db, type AttemptDetail, type VocabDeck, type VocabItem } from "../db";
import EmptyState from "../components/EmptyState.vue";
import BaseModal from "../components/BaseModal.vue";
import { useSessionGuard } from "../composables/useSessionGuard";
import { buildMatchRounds, packMatchRounds, type MatchPair } from "../services/match";
import { speak, speechSupported } from "../services/speech";
import { getSetting, setSetting } from "../services/settings";
import { toast } from "../services/dialog";
import { shuffle } from "../utils/shuffle";
import { uid } from "../utils/id";
import { clamp01, formatDuration } from "../utils/time";
import { t } from "../i18n";

/**
 * Match game: associate words (left) with their meanings (right), round after round.
 * - /match?deck=<deckId>  one deck
 * - /match                all decks (optional &tags=a,b)
 * Options: &dir=reverse (meanings on the left).
 */
const ROUND_SIZE = 6;
const ROUNDS = 3;

const route = useRoute();
const router = useRouter();

const deckId = computed(() => (route.query.deck ? String(route.query.deck) : undefined));
const reverse = computed(() => route.query.dir === "reverse");
const tags = computed(() => {
  const raw = String(route.query.tags ?? "").trim();
  return raw ? raw.split(",").map((x) => x.trim()).filter(Boolean) : [];
});
const refId = computed(() => deckId.value ?? "all");

const loaded = ref(false);
const deck = ref<VocabDeck | null>(null);
const decks = ref<Record<string, VocabDeck>>({});
const items = ref<VocabItem[]>([]);

// Game state
const rounds = ref<MatchPair[][]>([]);
const roundIdx = ref(0);
const leftOrder = ref<string[]>([]);
const rightOrder = ref<string[]>([]);
const selLeft = ref<string | null>(null);
const selRight = ref<string | null>(null);
const matched = ref<Set<string>>(new Set());
const doneCount = ref(0);
const mistakes = ref(0);
/** Pairs (by id) whose word was matched wrongly at least once. */
const missed = ref<Set<string>>(new Set());
const shake = ref<{ left: string; right: string } | null>(null);
const liveMsg = ref("");
const reviewGame = ref(false);
const advancing = ref(false);

const startedAt = ref(Date.now());
const now = ref(Date.now());
const endedAt = ref<number | null>(null);
let tick: number | undefined;
let shakeTimer: number | undefined;
let roundTimer: number | undefined;

// End screen
const showResult = ref(false);
const bestBefore = ref<number | null>(null);

const canSpeak = speechSupported();
const soundOn = ref(false);

const round = computed(() => rounds.value[roundIdx.value] ?? []);
const byId = computed(() => new Map(round.value.map((p) => [p.id, p])));
const totalPairs = computed(() => rounds.value.reduce((n, r) => n + r.length, 0));
const playing = computed(() => loaded.value && rounds.value.length > 0 && endedAt.value === null);
const elapsed = computed(() => Math.max(0, Math.floor(((endedAt.value ?? now.value) - startedAt.value) / 1000)));
const firstTry = computed(() => totalPairs.value - missed.value.size);
const accuracy = computed(() => (totalPairs.value ? Math.round((firstTry.value / totalPairs.value) * 100) : 0));
const isNewBest = computed(() => !reviewGame.value && bestBefore.value !== null && elapsed.value < bestBefore.value);
const bestTime = computed(() => {
  if (reviewGame.value) return bestBefore.value;
  return bestBefore.value === null ? elapsed.value : Math.min(bestBefore.value, elapsed.value);
});
const missedPairs = computed(() => rounds.value.flat().filter((p) => missed.value.has(p.id)));

const subtitle = computed(() => {
  const parts = [deck.value?.title ?? t("match.allDecks")];
  if (tags.value.length) parts.push(t("match.tags", { tags: tags.value.join(", ") }));
  if (reverse.value) parts.push(t("match.reversed"));
  return parts.join(" • ");
});

/** Column holding the original terms (the pairs keep the direction they were built with). */
const termSide = computed(() => (reverse.value ? "right" : "left"));
const board = ref<HTMLElement | null>(null);

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function clearTimers() {
  window.clearInterval(tick);
  window.clearTimeout(shakeTimer);
  window.clearTimeout(roundTimer);
  tick = shakeTimer = roundTimer = undefined;
}

function setupRound() {
  const r = round.value;
  leftOrder.value = shuffle(r.map((p) => p.id));
  rightOrder.value = shuffle(r.map((p) => p.id));
  selLeft.value = selRight.value = null;
  matched.value = new Set();
  shake.value = null;
  advancing.value = false;
}

function start(newRounds: MatchPair[][], isReview: boolean) {
  clearTimers();
  rounds.value = newRounds;
  roundIdx.value = 0;
  doneCount.value = 0;
  mistakes.value = 0;
  missed.value = new Set();
  reviewGame.value = isReview;
  showResult.value = false;
  endedAt.value = null;
  liveMsg.value = "";
  startedAt.value = now.value = Date.now();
  setupRound();
  if (newRounds.length) tick = window.setInterval(() => (now.value = Date.now()), 1000);
}

function newGame() {
  start(buildMatchRounds(items.value, { roundSize: ROUND_SIZE, rounds: ROUNDS, reverse: reverse.value }), false);
}

function reviewMistakes() {
  const pairs = missedPairs.value;
  if (!pairs.length) return;
  start(packMatchRounds(shuffle(pairs), { roundSize: ROUND_SIZE, rounds: Infinity, minRoundSize: 1 }), true);
}

async function load() {
  loaded.value = false;
  clearTimers();
  const all = await db.vocabDecks.toArray();
  decks.value = Object.fromEntries(all.map((d) => [d.id, d]));
  deck.value = deckId.value ? (decks.value[deckId.value] ?? null) : null;

  let list = deckId.value
    ? await db.vocabItems.where("deckId").equals(deckId.value).toArray()
    : await db.vocabItems.toArray();
  if (!deckId.value && tags.value.length) {
    const wanted = new Set(tags.value.map((x) => x.toLowerCase()));
    list = list.filter((it) => it.tags?.some((tg) => wanted.has(tg.toLowerCase())));
  }
  items.value = list;
  soundOn.value = canSpeak && (await getSetting("autoSpeak"));
  newGame();
  loaded.value = true;
}

function sayIfTerm(id: string, side: "left" | "right") {
  if (!soundOn.value || side !== termSide.value) return;
  const p = byId.value.get(id);
  if (p) speak(p.term, p.deckId ? decks.value[p.deckId]?.from : undefined);
}

async function toggleSound() {
  soundOn.value = !soundOn.value;
  await setSetting("autoSpeak", soundOn.value);
}

function pick(side: "left" | "right", id: string) {
  if (!playing.value || advancing.value || matched.value.has(id)) return;
  if (side === "left") selLeft.value = selLeft.value === id ? null : id;
  else selRight.value = selRight.value === id ? null : id;
  if ((side === "left" ? selLeft.value : selRight.value) === id) sayIfTerm(id, side);
  if (selLeft.value && selRight.value) check(selLeft.value, selRight.value);
}

function check(l: string, r: string) {
  const left = byId.value.get(l);
  const right = byId.value.get(r);
  selLeft.value = selRight.value = null;
  if (!left || !right) return;

  if (l === r) {
    matched.value = new Set(matched.value).add(l);
    doneCount.value += 1;
    liveMsg.value = t("match.correctLive", { left: left.left, right: right.right });
    if (matched.value.size === round.value.length) {
      advancing.value = true;
      roundTimer = window.setTimeout(nextRound, reducedMotion() ? 150 : 550);
    }
    return;
  }

  mistakes.value += 1;
  // The word on the left is the "question": that pair counts as missed.
  missed.value = new Set(missed.value).add(l);
  liveMsg.value = t("match.wrongLive", { left: left.left, right: right.right });
  window.clearTimeout(shakeTimer);
  shake.value = { left: l, right: r };
  shakeTimer = window.setTimeout(() => (shake.value = null), 450);
}

function nextRound() {
  if (roundIdx.value + 1 < rounds.value.length) {
    const hadFocus = !!board.value?.contains(document.activeElement);
    roundIdx.value += 1;
    setupRound();
    // Keyboard players keep their place: focus the first tile of the new round.
    if (hadFocus) void nextTick(() => board.value?.querySelector<HTMLButtonElement>(".tile")?.focus());
  } else {
    void finish();
  }
}

async function readBestTime(): Promise<number | null> {
  const prev = await db.attempts.where("refId").equals(refId.value).toArray();
  const key = [...tags.value].sort().join(",");
  const times = prev
    .filter((a) => a.type === "match" && [...(a.meta?.tags ?? [])].sort().join(",") === key)
    .map((a) => a.meta?.durationSeconds)
    .filter((s): s is number => typeof s === "number" && s > 0);
  return times.length ? Math.min(...times) : null;
}

async function finish() {
  if (endedAt.value !== null) return;
  endedAt.value = Date.now();
  window.clearInterval(tick);
  advancing.value = false;

  const durationSeconds = elapsed.value;
  const total = totalPairs.value;
  const correct = firstTry.value;

  try {
    bestBefore.value = await readBestTime();
  } catch {
    bestBefore.value = null;
  }
  showResult.value = true;

  // A mistakes review is a short replay: not saved, so it does not distort scores and best times.
  if (reviewGame.value || total === 0) return;

  const details: AttemptDetail[] = rounds.value.flat().map((p) => {
    const known = !missed.value.has(p.id);
    return { kind: "flashcard", id: String(p.id), term: String(p.left), definition: String(p.right), known, correct: known };
  });
  try {
    await db.attempts.add({
      id: uid("att"),
      type: "match",
      refId: refId.value,
      startedAt: startedAt.value,
      finishedAt: endedAt.value,
      score: clamp01(correct / total),
      meta: {
        total,
        correct,
        durationSeconds,
        ...(tags.value.length ? { tags: [...tags.value] } : {}),
        details
      }
    });
  } catch (e) {
    console.error("Match save failed:", e);
    toast(t("common.saveError"), "danger");
  }
}

function playAgain() {
  newGame();
}

async function goHome() {
  showResult.value = false;
  await router.push("/");
}

function closeResult() {
  void router.push(deckId.value ? `/deck/${deckId.value}` : "/");
}

function tileState(side: "left" | "right", id: string) {
  const sel = side === "left" ? selLeft.value : selRight.value;
  return {
    matched: matched.value.has(id),
    selected: sel === id,
    shake: shake.value?.[side] === id
  };
}

function tileLabel(side: "left" | "right", id: string) {
  const p = byId.value.get(id);
  const text = p ? (side === "left" ? p.left : p.right) : "";
  if (matched.value.has(id)) return `${text} (${t("match.matched")})`;
  if ((side === "left" ? selLeft.value : selRight.value) === id) return `${text} (${t("match.selected")})`;
  return text;
}

watch(
  () => [route.query.deck, route.query.dir, route.query.tags],
  () => {
    if (route.path === "/match") void load();
  }
);

useSessionGuard(() => playing.value && (doneCount.value > 0 || mistakes.value > 0));

onMounted(load);
onUnmounted(clearTimers);
</script>

<template>
  <div class="sessionPage">
    <div v-if="!loaded" class="card sessionCard"></div>

    <div v-else-if="deckId && !deck" class="card sessionCard">
      <EmptyState :title="$t('match.deckNotFound')" />
      <div class="row mt-3 justify-center">
        <router-link class="btn" to="/vocab">{{ $t("match.vocabLink") }}</router-link>
        <router-link class="btn" to="/">{{ $t("common.home") }}</router-link>
      </div>
    </div>

    <div v-else-if="!rounds.length" class="card sessionCard">
      <EmptyState icon="🧩" :title="$t('match.notEnough')" :hint="$t('match.notEnoughHint')" />
      <div class="row mt-3 justify-center">
        <router-link class="btn primary" to="/import">{{ $t("match.importLink") }}</router-link>
        <router-link class="btn" to="/vocab">{{ $t("match.vocabLink") }}</router-link>
      </div>
    </div>

    <div v-else class="sessionCard">
      <div class="row items-start">
        <div class="min-w-0">
          <h1 class="m-0 text-[1.4rem]">{{ $t("match.title") }}</h1>
          <p class="small m-0 mt-0.5 break-words">{{ subtitle }}</p>
        </div>
        <div class="flex gap-2">
          <button
            v-if="canSpeak"
            class="btn ghost"
            type="button"
            :class="{ 'text-accentText': soundOn }"
            :aria-pressed="soundOn"
            @click="toggleSound"
          >
            {{ soundOn ? $t("match.soundOn") : $t("match.soundOff") }}
          </button>
          <router-link class="btn" :to="deckId ? `/deck/${deckId}` : '/'">{{ $t("common.back") }}</router-link>
        </div>
      </div>

      <div
        class="meter mt-3"
        role="progressbar"
        :aria-label="$t('match.progress', { done: doneCount, total: totalPairs })"
        :aria-valuenow="doneCount"
        aria-valuemin="0"
        :aria-valuemax="totalPairs"
      >
        <span :style="{ width: `${totalPairs ? (doneCount / totalPairs) * 100 : 0}%` }"></span>
      </div>

      <div class="flex flex-wrap items-center gap-2 mt-3">
        <span class="badge accent">
          {{ reviewGame ? $t("match.reviewRound") : $t("match.round", { current: roundIdx + 1, total: rounds.length }) }}
        </span>
        <span class="badge" :title="$t('match.time')">⏱ <span class="tabular-nums">{{ formatDuration(elapsed) }}</span></span>
        <span class="badge" :class="{ 'text-danger': mistakes > 0 }">{{ $t("match.mistakesCount", { count: mistakes }) }}</span>
      </div>

      <div class="sessionBody py-3">
        <p class="small mt-0 mb-3">{{ $t("match.instructions") }}</p>
        <div ref="board" class="board">
          <ul class="column" :aria-label="reverse ? $t('match.definitions') : $t('match.terms')">
            <li v-for="id in leftOrder" :key="`l-${roundIdx}-${id}`">
              <button
                type="button"
                class="tile"
                :class="tileState('left', id)"
                :aria-pressed="selLeft === id"
                :aria-label="tileLabel('left', id)"
                :aria-disabled="matched.has(id)"
                @click="pick('left', id)"
              >
                {{ byId.get(id)?.left }}
              </button>
            </li>
          </ul>
          <ul class="column" :aria-label="reverse ? $t('match.terms') : $t('match.definitions')">
            <li v-for="id in rightOrder" :key="`r-${roundIdx}-${id}`">
              <button
                type="button"
                class="tile"
                :class="tileState('right', id)"
                :aria-pressed="selRight === id"
                :aria-label="tileLabel('right', id)"
                :aria-disabled="matched.has(id)"
                @click="pick('right', id)"
              >
                {{ byId.get(id)?.right }}
              </button>
            </li>
          </ul>
        </div>
        <p class="sr-only" aria-live="polite">{{ liveMsg }}</p>
      </div>

      <div class="sessionFooter">
        <p class="small m-0">{{ $t("match.progress", { done: doneCount, total: totalPairs }) }}</p>
      </div>
    </div>

    <BaseModal :open="showResult" :title="$t('match.resultTitle')" @close="closeResult">
      <div class="card" style="margin:0">
        <div class="results">
          <div>
            <div class="small">{{ $t("match.time") }}</div>
            <div class="kpi tabular-nums">{{ formatDuration(elapsed) }}</div>
          </div>
          <div>
            <div class="small">{{ $t("match.mistakes") }}</div>
            <div class="kpi">{{ mistakes }}</div>
          </div>
          <div>
            <div class="small">{{ $t("match.accuracy") }}</div>
            <div class="kpi">{{ accuracy }}%</div>
          </div>
          <div>
            <div class="small">{{ $t("match.bestTime") }}</div>
            <div class="kpi tabular-nums">{{ bestTime === null ? "—" : formatDuration(bestTime) }}</div>
          </div>
        </div>

        <p class="small mt-3 mb-0">{{ $t("match.firstTry", { correct: firstTry, total: totalPairs }) }}</p>
        <p v-if="isNewBest" class="mt-1 mb-0 font-bold text-accentText">{{ $t("match.newBest") }}</p>
        <p v-else-if="!reviewGame && bestBefore === null" class="small mt-1 mb-0">{{ $t("match.noBest") }}</p>
        <p v-if="!missedPairs.length" class="mt-1 mb-0 font-bold text-ok">{{ $t("match.perfect") }}</p>

        <div class="hr"></div>

        <div class="flex flex-wrap gap-2">
          <button class="btn primary" type="button" @click="playAgain">{{ $t("match.playAgain") }}</button>
          <button v-if="missedPairs.length" class="btn" type="button" @click="reviewMistakes">
            {{ $t("match.reviewMistakes") }} ({{ missedPairs.length }})
          </button>
          <button class="btn" type="button" @click="goHome">{{ $t("common.home") }}</button>
        </div>
      </div>
    </BaseModal>
  </div>
</template>

<style scoped>
.board {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
}
@media (min-width: 768px) {
  .board { gap: 1rem; }
}
.column {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.tile {
  font: inherit;
  appearance: none;
  -webkit-appearance: none;
  -webkit-tap-highlight-color: transparent;
  width: 100%;
  min-height: 52px;
  padding: 0.6rem 0.75rem;
  border-radius: 12px;
  border: 1px solid rgb(var(--border) / 0.15);
  background: rgb(var(--sunken) / 0.3);
  color: rgb(var(--text));
  font-weight: 600;
  line-height: 1.25;
  text-align: center;
  overflow-wrap: anywhere;
  cursor: pointer;
  transition: border-color 0.15s, background-color 0.15s, opacity 0.35s;
}
.tile:hover:not(.matched) {
  border-color: rgb(var(--border) / 0.3);
  background: rgb(var(--border) / 0.08);
}
.tile.selected {
  border-color: rgb(var(--accent));
  background: rgb(var(--accent) / 0.15);
}
.tile.matched {
  border-color: rgb(var(--ok) / 0.6);
  background: rgb(var(--ok) / 0.12);
  opacity: 0.45;
  cursor: default;
  animation: settle 0.3s ease-out;
}
.tile.shake {
  border-color: rgb(var(--danger) / 0.7);
  background: rgb(var(--danger) / 0.1);
  animation: shake 0.4s ease-in-out;
}
.results {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}
@keyframes settle {
  0% { transform: scale(1); opacity: 1; }
  40% { transform: scale(1.04); opacity: 1; }
  100% { transform: scale(1); opacity: 0.45; }
}
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-5px); }
  40% { transform: translateX(5px); }
  60% { transform: translateX(-3px); }
  80% { transform: translateX(3px); }
}
@media (prefers-reduced-motion: reduce) {
  .tile { transition: none; }
  .tile.matched, .tile.shake { animation: none; }
}
</style>
