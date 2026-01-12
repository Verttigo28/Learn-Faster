<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { db, type VocabDeck, type VocabItem } from "../db";
import EmptyState from "../components/EmptyState.vue";

/**
 * NOTE: le router passe deckId en prop (props:true).
 * Déclarer la prop supprime les warnings "Extraneous non-props attributes (deckId)".
 */
const props = defineProps<{ deckId?: string }>();

const route = useRoute();
const deckId = computed(() => props.deckId ?? String(route.params.deckId));

const deck = ref<VocabDeck | null>(null);
const items = ref<VocabItem[]>([]);

async function load() {
  deck.value = (await db.vocabDecks.get(deckId.value)) ?? null;
  items.value = await db.vocabItems.where("deckId").equals(deckId.value).toArray();
}

onMounted(load);
</script>

<template>
  <div class="grid">
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
        <router-link class="btn" :to="`/deck/${deckId}/flash`">Flashcards</router-link>

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

<style scoped>
/* Même logique que Phrases: page propre, scroll uniquement dans la liste */
.grid{
  max-width: 1100px;
  margin: 0 auto;
  align-items: start;
}

/* Card principale = "modal" : ne doit pas pousser la page */
.deckCard{
  /* hauteur raisonnable, sans prendre 100% */
  height: min(720px, calc(100vh - 32px));
  overflow: hidden;

  display: flex;
  flex-direction: column;
}

/* Bloc aperçu : doit pouvoir grandir mais rester dans le "modal" */
.previewCard{
  margin-top: 12px;
  border-radius: 18px;

  flex: 1 1 auto; /* prend l’espace restant */
  min-height: 0;  /* IMPORTANT pour que overflow fonctionne */

  display: flex;
  flex-direction: column;
  overflow: hidden; /* le scroll sera dans .previewList */
}

/* La liste scrolle dans la card aperçu */
.previewList{
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding-right: 6px;
}
</style>
