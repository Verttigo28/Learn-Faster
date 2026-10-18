<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { searchAll, type SearchHit } from "../services/search";
import EmptyState from "../components/EmptyState.vue";

const route = useRoute();
const router = useRouter();
const query = ref(String(route.query.q ?? ""));
const hits = ref<SearchHit[]>([]);
const input = ref<HTMLInputElement | null>(null);

const KIND_LABEL: Record<SearchHit["kind"], string> = { vocab: "search.kind.vocab", qcm: "search.kind.qcm", sentence: "search.kind.sentence" };
const counts = computed(() => {
  const c: Record<string, number> = { vocab: 0, qcm: 0, sentence: 0 };
  for (const h of hits.value) c[h.kind]++;
  return c;
});

let seq = 0;
async function run() {
  const mine = ++seq;
  const res = await searchAll(query.value);
  if (mine === seq) hits.value = res; // ignore stale results
}

let debounce: number | undefined;
watch(query, (q) => {
  window.clearTimeout(debounce);
  debounce = window.setTimeout(() => {
    router.replace({ query: q ? { q } : {} });
    run();
  }, 200);
});

onMounted(() => {
  input.value?.focus();
  run();
});
</script>

<template>
  <div class="page flex justify-center">
    <div class="card cardFill w-full max-w-[900px]">
      <h2>{{ $t("search.title") }}</h2>
      <input ref="input" v-model="query" class="input" :placeholder="$t('search.placeholder')" />
      <p class="small">
        <template v-if="query.trim().length >= 2">
          {{ $t("search.summary", { total: hits.length, vocab: counts.vocab, qcm: counts.qcm, sentence: counts.sentence }) }}
        </template>
        <template v-else>{{ $t("search.minChars") }}</template>
      </p>
      <div class="hr"></div>

      <div v-if="query.trim().length >= 2 && hits.length === 0" class="flex-1 min-h-0 flex items-center justify-center">
        <EmptyState :title="$t('search.noResults')" :hint="$t('search.noResultsHint')" />
      </div>

      <div v-else class="scrollY">
        <div class="list">
          <router-link v-for="h in hits" :key="`${h.kind}:${h.id}`" :to="h.link" class="card row no-underline hover:no-underline">
            <div class="min-w-0">
              <h3 class="m-0 truncate">{{ h.title }}</h3>
              <p class="small m-0 truncate">{{ h.subtitle }}</p>
            </div>
            <span class="badge">{{ $t(KIND_LABEL[h.kind]) }}</span>
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>
