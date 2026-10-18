<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { DEFAULT_SETTINGS, getAllSettings, setSetting, type Settings } from "../services/settings";
import { applyTheme } from "../services/theme";
import { speechSupported } from "../services/speech";
import { toast } from "../services/dialog";
import { formatDate } from "../utils/time";

const s = ref<Settings>({ ...DEFAULT_SETTINGS });
const loaded = ref(false);
const canSpeak = speechSupported();

async function load() {
  s.value = await getAllSettings();
  loaded.value = true;
}

function clampInt(v: number, min: number, max: number, fallback: number) {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}

async function save() {
  s.value.newPerDay = clampInt(s.value.newPerDay, 0, 500, DEFAULT_SETTINGS.newPerDay);
  s.value.dailyGoal = clampInt(s.value.dailyGoal, 1, 2000, DEFAULT_SETTINGS.dailyGoal);
  await Promise.all([
    setSetting("newPerDay", s.value.newPerDay),
    setSetting("dailyGoal", s.value.dailyGoal),
    setSetting("theme", s.value.theme),
    setSetting("autoSpeak", s.value.autoSpeak)
  ]);
  toast("Réglages enregistrés ✅", "ok");
}

// Preview the theme immediately.
watch(() => s.value.theme, (t) => { if (loaded.value) applyTheme(t); });

onMounted(load);
</script>

<template>
  <div class="page flex justify-center">
    <div class="card cardFill w-full max-w-[640px]">
      <div class="scrollY">
        <h2>Réglages</h2>

        <h3 class="mt-3">Répétition espacée</h3>
        <label class="small">Nouvelles cartes par jour</label>
        <input class="input" type="number" min="0" max="500" v-model.number="s.newPerDay" />
        <p class="small">Les cartes à revoir sont toujours proposées ; ce réglage limite seulement les nouvelles.</p>

        <h3 class="mt-3">Objectif quotidien</h3>
        <label class="small">Nombre de réponses par jour</label>
        <input class="input" type="number" min="1" max="2000" v-model.number="s.dailyGoal" />

        <h3 class="mt-3">Apparence</h3>
        <div class="pills">
          <button type="button" class="pill" :class="{ active: s.theme === 'dark' }" @click="s.theme = 'dark'">🌙 Sombre</button>
          <button type="button" class="pill" :class="{ active: s.theme === 'light' }" @click="s.theme = 'light'">☀️ Clair</button>
          <button type="button" class="pill" :class="{ active: s.theme === 'system' }" @click="s.theme = 'system'">🖥️ Système</button>
        </div>

        <template v-if="canSpeak">
          <h3 class="mt-3">Audio</h3>
          <label class="badge cursor-pointer">
            <input type="checkbox" v-model="s.autoSpeak" />
            Lire automatiquement les flashcards à voix haute
          </label>
        </template>

        <h3 class="mt-3">Sauvegarde</h3>
        <p class="small">
          Dernier export :
          <b class="text-text">{{ s.lastExportAt ? formatDate(s.lastExportAt) : "jamais" }}</b>.
          Les données restent dans ce navigateur / cet appareil : exporte-les régulièrement depuis l’accueil.
        </p>

        <div class="hr"></div>
        <div class="row">
          <button class="btn ok" @click="save">Enregistrer</button>
          <router-link class="btn" to="/">Retour</router-link>
        </div>
      </div>
    </div>
  </div>
</template>
