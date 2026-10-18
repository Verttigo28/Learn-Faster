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
      <EmptyState title="Deck introuvable" />
    </div>

    <div v-else class="card deckCard">
      <div class="row">
        <div>
          <h2 style="margin:0">{{ deck.title }}</h2>
          <p class="small" style="margin:4px 0 0 0">
            {{ deck.from }} → {{ deck.to }} • {{ items.length }} items
          </p>
        </div>
        <router-link class="btn" to="/">Retour</router-link>
      </div>

      <div class="hr"></div>

      <div class="row" style="flex-wrap:wrap">
        <router-link class="btn primary" :to="`/deck/${deckId}/flash?mode=due`">🧠 Réviser ({{ dueCount }})</router-link>
        <router-link class="btn" :to="`/deck/${deckId}/flash`">Flashcards</router-link>
        <router-link class="btn" :to="`/deck/${deckId}/flash?dir=reverse`">Sens inverse</router-link>

        <!-- Bouton "Quiz (QCM)" supprimé comme demandé -->
        <!-- <router-link class="btn" :to="`/deck/${deckId}/quiz`">Quiz (QCM)</router-link> -->

        <router-link class="btn" to="/exams">Exam par tags</router-link>
        <router-link class="btn" to="/stats">Stats</router-link>
      </div>

      <div v-if="items.length" class="card previewCard">
        <h3 style="margin-top:0">Contenu (aperçu)</h3>

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
        <EmptyState title="Deck vide" hint="Importe des items depuis la page Import." />
        <router-link class="btn" to="/import" style="margin-top:12px; display:inline-block">Importer</router-link>
      </div>
    </div>
  </div>
</template>

