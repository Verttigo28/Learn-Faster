<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { db, type VocabDeck, type VocabItem } from "../db";
import EmptyState from "../components/EmptyState.vue";
import { buildReviewQueue } from "../services/srs";

/**
 * NOTE: le router passe deckId en prop (props:true).
 * Déclarer la prop supprime les warnings "Extraneous non-props attributes (deckId)".
 */
const props = defineProps<{ deckId?: string }>();

const route = useRoute();
const deckId = computed(() => props.deckId ?? String(route.params.deckId));

const deck = ref<VocabDeck | null>(null);
const items = ref<VocabItem[]>([]);
const dueCount = ref(0);

async function load() {
  deck.value = (await db.vocabDecks.get(deckId.value)) ?? null;
  items.value = await db.vocabItems.where("deckId").equals(deckId.value).toArray();
  dueCount.value = (await buildReviewQueue({ deckId: deckId.value })).length;
}

onMounted(load);
</script>

<template>
  <div class="grid deckGrid">
    <div v-if="!deck">
      <EmptyState :title="$t('vocab.notFound')" />
    </div>

    <div v-else class="card deckCard">
      <div class="row">
        <div>
          <h2 style="margin:0">{{ deck.title }}</h2>
          <p class="small" style="margin:4px 0 0 0">
            {{ deck.from }} → {{ deck.to }} • {{ $t("common.items", { count: items.length }) }}
          </p>
        </div>
        <router-link class="btn" to="/">{{ $t("common.back") }}</router-link>
      </div>

      <div class="hr"></div>

      <div class="row" style="flex-wrap:wrap">
        <router-link class="btn primary" :to="`/deck/${deckId}/flash?mode=due`">{{ $t("vocab.deck.review", { count: dueCount }) }}</router-link>
        <router-link class="btn" :to="`/deck/${deckId}/flash`">{{ $t("vocab.flashcards") }}</router-link>
        <router-link class="btn" :to="`/deck/${deckId}/flash?dir=reverse`">{{ $t("vocab.deck.reverse") }}</router-link>

        <!-- Bouton "Quiz (QCM)" supprimé comme demandé -->
        <!-- <router-link class="btn" :to="`/deck/${deckId}/quiz`">Quiz (QCM)</router-link> -->

        <router-link class="btn" to="/exams">{{ $t("vocab.deck.examByTags") }}</router-link>
        <router-link class="btn" to="/stats">{{ $t("nav.stats") }}</router-link>
      </div>

      <div v-if="items.length" class="card previewCard">
        <h3 style="margin-top:0">{{ $t("vocab.deck.preview") }}</h3>

        <!-- ✅ Scroll uniquement ici -->
        <div class="list previewList">
          <div v-for="it in items" :key="it.id" class="row">
            <div>
              <div><b>{{ it.term }}</b></div>
              <div class="small">{{ it.definition }}</div>
            </div>
            <span class="badge" v-if="it.tags?.length">{{ it.tags.join(", ") }}</span>
          </div>
        </div>
      </div>

      <div v-else style="margin-top:12px">
        <EmptyState :title="$t('vocab.deck.emptyTitle')" :hint="$t('vocab.deck.emptyHint')" />
        <router-link class="btn" to="/import" style="margin-top:12px; display:inline-block">{{ $t("vocab.deck.import") }}</router-link>
      </div>
    </div>
  </div>
</template>

