<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { db, type ReviewState, type VocabDeck, type VocabItem } from "../db";
import EmptyState from "../components/EmptyState.vue";
import { deckProgress } from "../services/stats";
import { wordStatus, type WordStatus } from "../services/deckProgress";
import { speak, speechSupported } from "../services/speech";
import { normalizeAnswer } from "../utils/answer";

/**
 * NOTE: le router passe deckId en prop (props:true).
 * Déclarer la prop supprime les warnings "Extraneous non-props attributes (deckId)".
 */
const props = defineProps<{ deckId?: string }>();

const route = useRoute();
const deckId = computed(() => props.deckId ?? String(route.params.deckId));

type Row = { item: VocabItem; status: WordStatus; key: string };

const deck = ref<VocabDeck | null>(null);
const loaded = ref(false);
const rows = ref<Row[]>([]);
const progress = ref({ total: 0, fresh: 0, learning: 0, mastered: 0 });
const dueCount = ref(0);
const query = ref("");
const canSpeak = speechSupported();

const visible = computed(() => {
  const q = normalizeAnswer(query.value);
  return q ? rows.value.filter((r) => r.key.includes(q)) : rows.value;
});

function pct(n: number, total: number): string {
  return total ? `${(n / total) * 100}%` : "0%";
}

async function load() {
  const id = deckId.value;
  const [d, items, reviews] = await Promise.all([
    db.vocabDecks.get(id),
    db.vocabItems.where("deckId").equals(id).toArray(),
    db.reviews.where("deckId").equals(id).toArray()
  ]);
  deck.value = d ?? null;
  const forward = new Map<string, ReviewState>();
  for (const r of reviews) if (r.direction === "forward") forward.set(r.itemId, r);
  const now = Date.now();
  rows.value = items.map((item) => ({
    item,
    status: wordStatus(forward.get(item.id), now),
    key: normalizeAnswer(`${item.term} ${item.definition}`)
  }));
  dueCount.value = rows.value.filter((r) => r.status === "due").length;
  progress.value = deckProgress(items, reviews)[0] ?? { total: 0, fresh: 0, learning: 0, mastered: 0 };
  loaded.value = true;
}

function say(term: string) {
  void speak(term, deck.value?.from);
}

onMounted(load);
watch(deckId, load);
</script>

<template>
  <div class="deckPage">
    <div v-if="loaded && !deck" class="card">
      <EmptyState :title="$t('vocab.notFound')" />
      <div class="flex justify-center">
        <router-link class="btn" to="/vocab">{{ $t("common.back") }}</router-link>
      </div>
    </div>

    <div v-else-if="deck" class="deckLayout">
      <section class="card deckSide">
        <h1 class="deckTitle">{{ deck.title }}</h1>
        <p class="small m-0">{{ deck.from }} → {{ deck.to }} • {{ $t("vocab.words", { count: progress.total }) }}</p>

        <div class="mt-4">
          <div
            class="progressBar"
            role="img"
            :aria-label="$t('vocab.deck.progressAria', { mastered: progress.mastered, total: progress.total })"
          >
            <span v-if="progress.mastered" class="stage-mastered" :style="{ width: pct(progress.mastered, progress.total) }"></span>
            <span v-if="progress.learning" class="stage-learning" :style="{ width: pct(progress.learning, progress.total) }"></span>
            <span v-if="progress.fresh || !progress.total" class="stage-fresh" :style="{ width: progress.total ? pct(progress.fresh, progress.total) : '100%' }"></span>
          </div>
          <div class="legend small">
            <span><span class="legendSwatch stage-fresh"></span>{{ $t("vocab.deck.count.new", { count: progress.fresh }) }}</span>
            <span><span class="legendSwatch stage-learning"></span>{{ $t("vocab.deck.count.learning", { count: progress.learning }) }}</span>
            <span><span class="legendSwatch stage-mastered"></span>{{ $t("vocab.deck.count.mastered", { count: progress.mastered }) }}</span>
          </div>
        </div>

        <p class="mt-3 mb-0">
          <span v-if="dueCount" class="dueDot">{{ $t("vocab.dueToday", { count: dueCount }) }}</span>
          <span v-else class="small">{{ $t("vocab.nothingDue") }}</span>
        </p>

        <div class="hr"></div>

        <div class="actions">
          <router-link v-if="dueCount" class="btn primary lg mainAction" :to="`/deck/${deckId}/flash?mode=due`">
            {{ $t("vocab.review", { count: dueCount }) }}
          </router-link>
          <router-link v-else class="btn primary lg mainAction" :to="`/deck/${deckId}/flash${progress.fresh ? '?mode=due' : ''}`">{{ $t("vocab.study") }}</router-link>

          <div class="actionGrid">
            <router-link class="btn" :to="`/deck/${deckId}/flash`">{{ $t("vocab.flashcards") }}</router-link>
            <router-link class="btn" :to="`/deck/${deckId}/flash?dir=reverse`">{{ $t("vocab.deck.reverse") }}</router-link>
            <router-link class="btn" :to="`/match?deck=${deckId}`">{{ $t("vocab.deck.match") }}</router-link>
            <router-link class="btn" :to="`/vocab/${deckId}/edit`">{{ $t("common.edit") }}</router-link>
          </div>

          <router-link class="btn ghost self-start" to="/">{{ $t("common.back") }}</router-link>
        </div>
      </section>

      <section class="card deckWords">
        <div class="wordsHead">
          <h2 class="m-0">{{ $t("vocab.deck.wordsHeading") }}</h2>
          <input
            v-if="rows.length"
            v-model="query"
            class="input wordSearch"
            type="search"
            :placeholder="$t('vocab.deck.searchWords')"
            :aria-label="$t('vocab.deck.searchWords')"
          />
        </div>

        <div v-if="!rows.length" class="py-2">
          <EmptyState :title="$t('vocab.deck.emptyTitle')" :hint="$t('vocab.deck.emptyHint')" />
          <div class="flex justify-center">
            <router-link class="btn" to="/import">{{ $t("vocab.deck.import") }}</router-link>
          </div>
        </div>

        <p v-else-if="!visible.length" class="small text-center py-6">{{ $t("vocab.deck.noMatch", { query }) }}</p>

        <ul v-else class="scrollY wordList">
          <li v-for="r in visible" :key="r.item.id" class="wordRow">
            <div class="min-w-0 flex-1">
              <div class="font-bold wordText">{{ r.item.term }}</div>
              <div class="small wordText">{{ r.item.definition }}</div>
            </div>
            <span :class="['status', `status-${r.status}`]">{{ $t(`vocab.deck.status.${r.status}`) }}</span>
            <button
              v-if="canSpeak"
              class="btn ghost speakBtn"
              :aria-label="$t('vocab.deck.listen', { term: r.item.term })"
              :title="$t('vocab.deck.listen', { term: r.item.term })"
              @click="say(r.item.term)"
            >🔊</button>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.deckPage {
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  max-width: 1100px;
  margin: 0 auto;
  -webkit-overflow-scrolling: touch;
}
.deckLayout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
  padding-bottom: 1.25rem;
}
.deckSide,
.deckWords {
  min-width: 0;
}
.deckWords {
  display: flex;
  flex-direction: column;
}
@media (min-width: 768px) {
  .deckPage { overflow: hidden; }
  .deckLayout {
    height: 100%;
    grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
    align-items: stretch;
    padding-bottom: 0;
  }
  .deckSide { overflow-y: auto; }
  .deckWords { min-height: 0; overflow: hidden; }
}
.deckTitle {
  overflow-wrap: anywhere;
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.9rem;
  margin-top: 0.5rem;
}
.actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.mainAction {
  width: 100%;
}
.actionGrid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
}
.actionGrid .btn {
  white-space: normal;
  text-align: center;
}
.wordsHead {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 0.75rem;
  margin-bottom: 0.75rem;
}
.wordSearch {
  flex: 1 1 180px;
  max-width: 280px;
}
.wordList {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.wordRow {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0.5rem 0.5rem 0.75rem;
  border-radius: 12px;
}
.wordRow:nth-child(odd) {
  background: rgb(var(--sunken) / 0.3);
}
.wordText {
  overflow-wrap: anywhere;
}
.status {
  flex: none;
  font-size: 12px;
  font-weight: 700;
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
  border: 1px solid rgb(var(--border) / 0.15);
  color: rgb(var(--muted));
  white-space: nowrap;
}
.status-learning {
  border-color: rgb(var(--accent) / 0.35);
  color: rgb(var(--text));
}
.status-mastered {
  border-color: rgb(var(--accent) / 0.7);
  color: rgb(var(--accent-text));
}
.status-due {
  border-color: rgb(var(--accent));
  background: rgb(var(--accent));
  color: rgb(var(--accent-ink));
}
.speakBtn {
  flex: none;
  padding: 0.3rem 0.45rem;
}
</style>
