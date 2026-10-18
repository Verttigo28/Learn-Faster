<script setup lang="ts">
import { confirmDialog } from "../services/dialog";
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { db, type VocabDeck } from "../db";
import { uid } from "../utils/id";
import { t } from "../i18n";
import EmptyState from "../components/EmptyState.vue";
import ConfirmBar from "../components/ConfirmBar.vue";

const router = useRouter();

const decks = ref<VocabDeck[]>([]);
const counts = ref<Record<string, number>>({});
const msg = ref<{ kind: "info" | "ok" | "danger"; text: string } | null>(null);

const title = ref("");
const from = ref("id");
const to = ref("fr");

function set(kind: "info" | "ok" | "danger", text: string) {
  msg.value = { kind, text };
}

async function load() {
  decks.value = await db.vocabDecks.orderBy("createdAt").reverse().toArray();
  const items = await db.vocabItems.toArray();
  const map: Record<string, number> = {};
  for (const it of items) map[it.deckId] = (map[it.deckId] ?? 0) + 1;
  counts.value = map;
}

async function createDeck() {
  const name = title.value.trim();
  if (!name) return set("danger", t("vocab.titleRequired"));

  const deck: VocabDeck = {
    id: uid("deck"),
    title: name,
    from: (from.value || "id").trim(),
    to: (to.value || "fr").trim(),
    createdAt: Date.now()
  };
  await db.vocabDecks.add(deck);
  title.value = "";
  set("ok", t("vocab.manage.created"));
  await load();
}

async function removeDeck(id: string) {
  if (!(await confirmDialog(t("vocab.manage.deleteConfirm")))) return;
  await db.transaction("rw", [db.vocabDecks, db.vocabItems, db.reviews], async () => {
    await db.vocabDecks.delete(id);
    await db.vocabItems.where("deckId").equals(id).delete();
    await db.reviews.where("deckId").equals(id).delete();
  });
  set("ok", t("vocab.manage.deleted"));
  await load();
}

async function editDeck(id: string) {
  await router.push(`/vocab/${id}/edit`);
}

onMounted(load);
</script>

<template>
  <!-- ✅ Pas de scroll global : liste des decks scrollable à droite -->
  <div class="manageGrid">
    <div class="card cardFill">
      <div class="scrollY">
      <h2>{{ $t("vocab.manage.heading") }}</h2>
      <p class="small">{{ $t("vocab.manage.intro") }}</p>

      <div class="hr"></div>

      <h3>{{ $t("vocab.manage.newDeck") }}</h3>
      <label class="small">{{ $t("common.title") }}</label>
      <input class="input" v-model="title" :placeholder="$t('vocab.manage.titlePlaceholder')" />

      <div class="row" style="margin-top:8px; gap:10px">
        <div style="flex:1">
          <label class="small">{{ $t("common.from") }}</label>
          <input class="input" v-model="from" placeholder="id" />
        </div>
        <div style="flex:1">
          <label class="small">{{ $t("common.to") }}</label>
          <input class="input" v-model="to" placeholder="fr" />
        </div>
      </div>

      <div class="row" style="margin-top:12px">
        <button class="btn" @click="createDeck">{{ $t("common.create") }}</button>
        <router-link class="btn" to="/exams">{{ $t("vocab.launchExam") }}</router-link>
      </div>

      <div v-if="msg" style="margin-top:12px">
        <ConfirmBar :message="msg.text" :kind="msg.kind" />
      </div>
      </div>
    </div>

    <div class="card cardFill">
      <div class="row flex-none mb-2.5">
        <h2 class="m-0">{{ $t("vocab.manage.listTitle") }}</h2>
        <span class="small">{{ decks.length }}</span>
      </div>

      <div v-if="decks.length === 0" class="flex-1 min-h-0 flex items-center justify-center">
        <EmptyState :title="$t('vocab.manage.emptyTitle')" :hint="$t('vocab.manage.emptyHint')" />
      </div>

      <div v-else class="scrollY">
        <div class="list">
          <div v-for="d in decks" :key="d.id" class="card">
            <div class="row">
              <div>
                <h3 class="m-0">{{ d.title }}</h3>
                <p class="small mt-1">
                  {{ d.from }} → {{ d.to }} • {{ $t("common.items", { count: counts[d.id] ?? 0 }) }}
                </p>
              </div>
              <div class="row" style="gap:8px">
                <!-- ✅ Apprendre -->
                <router-link class="btn" :to="`/deck/${d.id}`">{{ $t("common.open") }}</router-link>
                <router-link class="btn" :to="`/deck/${d.id}/flash`">{{ $t("vocab.flashcards") }}</router-link>

                <!-- ✅ Gérer -->
                <button class="btn" @click="editDeck(d.id)">{{ $t("common.edit") }}</button>
                <button class="btn danger" @click="removeDeck(d.id)">{{ $t("common.delete") }}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

