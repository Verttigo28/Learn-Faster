<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { installPack, listPacks, sortPacksFor, type PackInfo } from "../services/packs";
import { toast } from "../services/dialog";
import { db } from "../db";
import { locale, t } from "../i18n";

const emit = defineEmits<{ (e: "installed"): void }>();

const packs = ref<PackInfo[]>([]);
const installedIds = ref<Set<string>>(new Set());
const busy = ref<string | null>(null);
const progress = ref({ done: 0, total: 0 });

const sorted = computed(() => sortPacksFor(packs.value, locale.value));

/** A pack counts as installed when its first vocab deck exists. */
async function refreshInstalled() {
  const ids = new Set<string>();
  for (const p of packs.value) {
    const first = p.files.find((f) => f.includes("/vocab/"));
    const deckId = first?.split("/").pop()?.replace(/\.json$/, "");
    if (deckId && (await db.vocabDecks.get(deckId))) ids.add(p.id);
  }
  installedIds.value = ids;
}

async function install(p: PackInfo) {
  busy.value = p.id;
  progress.value = { done: 0, total: p.files.length };
  try {
    const r = await installPack(p, (done, total) => (progress.value = { done, total }));
    toast(t("packs.installed", { decks: r.decks, exams: r.exams, sentenceDecks: r.sentenceDecks }), "ok", 5000);
    await refreshInstalled();
    emit("installed");
  } catch (e) {
    toast(t("packs.error", { error: e instanceof Error ? e.message : String(e) }), "danger", 6000);
  } finally {
    busy.value = null;
  }
}

onMounted(async () => {
  try {
    packs.value = await listPacks();
    await refreshInstalled();
  } catch {
    toast(t("packs.loadError"), "danger");
  }
});
</script>

<template>
  <section v-if="packs.length" class="card">
    <h2 class="m-0">📦 {{ $t("packs.title") }}</h2>
    <p class="small">{{ $t("packs.subtitle") }}</p>
    <div class="list mt-2">
      <div v-for="p in sorted" :key="p.id" class="row card" style="border-radius:18px">
        <div class="min-w-0">
          <h3 class="m-0">
            {{ p.title }}
            <span v-if="p.uiLang === locale" class="badge ml-1">{{ $t("packs.forYourLanguage") }}</span>
          </h3>
          <p class="small m-0">{{ p.description }}</p>
          <p class="small m-0">{{ $t("packs.counts", p.counts) }}</p>
        </div>
        <button class="btn" :class="installedIds.has(p.id) ? '' : 'primary'" :disabled="busy !== null" @click="install(p)">
          <template v-if="busy === p.id">{{ $t("packs.installing", progress) }}</template>
          <template v-else>{{ installedIds.has(p.id) ? $t("packs.reinstall") : $t("packs.install") }}</template>
        </button>
      </div>
    </div>
  </section>
</template>
