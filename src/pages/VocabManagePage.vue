<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import { db, type VocabDeck } from "../db";
import { uid } from "../utils/id";
import { t } from "../i18n";
import { confirmDialog, toast } from "../services/dialog";
import { deckProgress, type DeckProgress } from "../services/stats";
import { dueCountByDeck } from "../services/deckProgress";
import { normalizeAnswer } from "../utils/answer";
import EmptyState from "../components/EmptyState.vue";
import BaseModal from "../components/BaseModal.vue";

type Tile = { deck: VocabDeck; progress: DeckProgress; due: number; key: string };

const router = useRouter();

const tiles = ref<Tile[]>([]);
const loaded = ref(false);
const query = ref("");
const menuFor = ref<string | null>(null);

const createOpen = ref(false);
const title = ref("");
const from = ref("id");
const to = ref("fr");
const formError = ref("");

const visible = computed(() => {
  const q = normalizeAnswer(query.value);
  return q ? tiles.value.filter((x) => x.key.includes(q)) : tiles.value;
});

function pct(n: number, total: number): string {
  return total ? `${(n / total) * 100}%` : "0%";
}

async function load() {
  const [decks, items, reviews] = await Promise.all([
    db.vocabDecks.toArray(),
    db.vocabItems.toArray(),
    db.reviews.toArray()
  ]);
  const progress = new Map(deckProgress(items, reviews).map((p) => [p.deckId, p]));
  const due = dueCountByDeck(reviews);
  tiles.value = decks
    .map((deck) => ({
      deck,
      progress: progress.get(deck.id) ?? { deckId: deck.id, total: 0, fresh: 0, learning: 0, mastered: 0 },
      due: due.get(deck.id) ?? 0,
      key: normalizeAnswer(deck.title)
    }))
    .sort((a, b) => Number(b.due > 0) - Number(a.due > 0) || a.deck.title.localeCompare(b.deck.title));
  loaded.value = true;
}

function openCreate() {
  title.value = "";
  formError.value = "";
  createOpen.value = true;
}

async function createDeck() {
  const name = title.value.trim();
  if (!name) {
    formError.value = t("vocab.titleRequired");
    return;
  }
  const deck: VocabDeck = {
    id: uid("deck"),
    title: name,
    from: (from.value || "id").trim(),
    to: (to.value || "fr").trim(),
    createdAt: Date.now()
  };
  await db.vocabDecks.add(deck);
  createOpen.value = false;
  toast(t("vocab.manage.created"), "ok");
  await load();
}

function toggleMenu(id: string) {
  menuFor.value = menuFor.value === id ? null : id;
}

async function editDeck(id: string) {
  menuFor.value = null;
  await router.push(`/vocab/${id}/edit`);
}

async function removeDeck(id: string) {
  menuFor.value = null;
  if (!(await confirmDialog(t("vocab.manage.deleteConfirm")))) return;
  await db.transaction("rw", [db.vocabDecks, db.vocabItems, db.reviews], async () => {
    await db.vocabDecks.delete(id);
    await db.vocabItems.where("deckId").equals(id).delete();
    await db.reviews.where("deckId").equals(id).delete();
  });
  toast(t("vocab.manage.deleted"), "ok");
  await load();
}

function closeMenu() {
  menuFor.value = null;
}
function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") menuFor.value = null;
}

onMounted(() => {
  document.addEventListener("click", closeMenu);
  document.addEventListener("keydown", onKey);
  void load();
});
onUnmounted(() => {
  document.removeEventListener("click", closeMenu);
  document.removeEventListener("keydown", onKey);
});
</script>

<template>
  <div class="library">
    <header class="libHead">
      <div class="flex items-baseline gap-2 min-w-0">
        <h1 class="m-0">{{ $t("vocab.manage.heading") }}</h1>
        <span v-if="tiles.length" class="small">{{ $t("vocab.manage.deckCount", { count: tiles.length }) }}</span>
      </div>
      <div class="libTools">
        <input
          v-if="tiles.length"
          v-model="query"
          class="input libSearch"
          type="search"
          :placeholder="$t('vocab.manage.search')"
          :aria-label="$t('vocab.manage.search')"
        />
        <button class="btn primary flex-none" @click="openCreate">{{ $t("vocab.manage.newDeck") }}</button>
      </div>
    </header>

    <div v-if="loaded && tiles.length === 0" class="card libEmpty">
      <EmptyState :title="$t('vocab.manage.emptyTitle')" :hint="$t('vocab.manage.emptyHint')" />
      <div class="flex flex-wrap justify-center gap-2">
        <router-link class="btn primary" to="/import">{{ $t("vocab.manage.importWords") }}</router-link>
        <button class="btn" @click="openCreate">{{ $t("vocab.manage.newDeck") }}</button>
      </div>
    </div>

    <p v-else-if="loaded && visible.length === 0" class="small text-center py-8">
      {{ $t("vocab.manage.noMatch", { query }) }}
    </p>

    <div v-else class="tileGrid">
      <article v-for="x in visible" :key="x.deck.id" class="card tile">
        <div class="flex items-start gap-2">
          <router-link class="tileTitle" :to="`/deck/${x.deck.id}`">{{ x.deck.title }}</router-link>
          <div class="relative flex-none">
            <button
              class="btn ghost moreBtn"
              :aria-label="$t('vocab.manage.more', { title: x.deck.title })"
              aria-haspopup="menu"
              :aria-expanded="menuFor === x.deck.id"
              @click.stop="toggleMenu(x.deck.id)"
            >⋯</button>
            <div v-if="menuFor === x.deck.id" class="tileMenu" role="menu" @click.stop>
              <button class="menuItem" role="menuitem" @click="editDeck(x.deck.id)">{{ $t("common.edit") }}</button>
              <button class="menuItem danger" role="menuitem" @click="removeDeck(x.deck.id)">{{ $t("common.delete") }}</button>
            </div>
          </div>
        </div>

        <p class="small m-0">
          {{ x.deck.from }} → {{ x.deck.to }} • {{ $t("vocab.words", { count: x.progress.total }) }}
        </p>

        <div
          class="progressBar h-1.5"
          role="img"
          :aria-label="$t('vocab.deck.progressAria', { mastered: x.progress.mastered, total: x.progress.total })"
        >
          <span v-if="x.progress.mastered" class="stage-mastered" :style="{ width: pct(x.progress.mastered, x.progress.total) }"></span>
          <span v-if="x.progress.learning" class="stage-learning" :style="{ width: pct(x.progress.learning, x.progress.total) }"></span>
          <span v-if="x.progress.fresh || !x.progress.total" class="stage-fresh" :style="{ width: x.progress.total ? pct(x.progress.fresh, x.progress.total) : '100%' }"></span>
        </div>

        <div class="tileFoot">
          <span v-if="x.due" class="dueDot truncate">{{ $t("vocab.dueToday", { count: x.due }) }}</span>
          <span v-else class="small truncate">{{ $t("vocab.nothingDue") }}</span>
          <router-link v-if="x.due" class="btn primary" :to="`/deck/${x.deck.id}/flash?mode=due`">
            {{ $t("vocab.review", { count: x.due }) }}
          </router-link>
          <!-- New words go through the SRS queue (daily new-card limit); fully learned decks open as free study -->
          <router-link v-else class="btn" :to="`/deck/${x.deck.id}/flash${x.progress.fresh ? '?mode=due' : ''}`">{{ $t("vocab.study") }}</router-link>
        </div>
      </article>
    </div>

    <BaseModal :open="createOpen" :title="$t('vocab.manage.newDeck')" @close="createOpen = false">
      <form class="flex flex-col gap-3" @submit.prevent="createDeck">
        <div>
          <label class="small" for="newDeckTitle">{{ $t("common.title") }}</label>
          <input id="newDeckTitle" v-model="title" class="input" :placeholder="$t('vocab.manage.titlePlaceholder')" />
          <p v-if="formError" class="text-danger text-sm mt-1 mb-0">{{ formError }}</p>
        </div>
        <div class="flex gap-2.5">
          <div class="flex-1 min-w-0">
            <label class="small" for="newDeckFrom">{{ $t("common.from") }}</label>
            <input id="newDeckFrom" v-model="from" class="input" placeholder="id" />
          </div>
          <div class="flex-1 min-w-0">
            <label class="small" for="newDeckTo">{{ $t("common.to") }}</label>
            <input id="newDeckTo" v-model="to" class="input" placeholder="fr" />
          </div>
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn ghost" @click="createOpen = false">{{ $t("common.cancel") }}</button>
          <button type="submit" class="btn primary">{{ $t("common.create") }}</button>
        </div>
      </form>
    </BaseModal>
  </div>
</template>

<style scoped>
.library {
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  max-width: 1100px;
  margin: 0 auto;
  padding-bottom: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  -webkit-overflow-scrolling: touch;
}
.libHead {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}
.libTools {
  display: flex;
  gap: 0.5rem;
  flex: 1 1 260px;
  justify-content: flex-end;
  min-width: 0;
}
.libSearch {
  flex: 1 1 auto;
  min-width: 0;
  max-width: 320px;
}
.libEmpty {
  padding-bottom: 1.5rem;
}
.tileGrid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
}
@media (min-width: 768px) {
  .tileGrid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (min-width: 1024px) {
  .tileGrid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
.tile {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  min-width: 0;
}
.tileTitle {
  flex: 1;
  min-width: 0;
  font-family: "Bricolage Grotesque Variable", "Atkinson Hyperlegible", system-ui, sans-serif;
  font-size: 1.05rem;
  font-weight: 700;
  line-height: 1.2;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
}
.moreBtn {
  padding: 0.2rem 0.55rem;
  font-size: 1.1rem;
  line-height: 1;
  color: rgb(var(--muted));
}
.tileMenu {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  z-index: 20;
  min-width: 140px;
  display: flex;
  flex-direction: column;
  padding: 4px;
  border-radius: 12px;
  border: 1px solid rgb(var(--border) / 0.12);
  background: rgb(var(--card));
  box-shadow: 0 12px 28px -12px rgb(0 0 0 / 0.6);
}
.menuItem {
  font: inherit;
  text-align: left;
  padding: 0.5rem 0.75rem;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: rgb(var(--text));
  cursor: pointer;
}
.menuItem:hover,
.menuItem:focus-visible {
  background: rgb(var(--border) / 0.07);
}
.menuItem.danger {
  color: rgb(var(--danger));
}
.tileFoot {
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
</style>
