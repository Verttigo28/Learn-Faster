<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import { DEFAULT_SETTINGS, getAllSettings, setSetting, type Settings } from "../services/settings";
import { applyTheme } from "../services/theme";
import { speechSupported } from "../services/speech";
import { confirmDialog, toast } from "../services/dialog";
import { exportAllData } from "../services/exporter";
import { saveJson } from "../services/fileSave";
import { db } from "../db";
import { formatDate } from "../utils/time";
import { detectLocale, isLocale, locale, setLocale, t } from "../i18n";
import { LOCALES } from "../i18n/locales";

const s = ref<Settings>({ ...DEFAULT_SETTINGS });
const loaded = ref(false);
const canSpeak = speechSupported();
let savedTheme = (document.documentElement.dataset.theme as Settings["theme"] | undefined) ?? DEFAULT_SETTINGS.theme;

const languages = Object.entries(LOCALES).map(([code, l]) => ({ code, name: l.name }));

async function load() {
  s.value = await getAllSettings();
  savedTheme = s.value.theme;
  loaded.value = true;
}

/** The language applies and is stored immediately ("" = follow the device). */
async function changeLanguage(code: string) {
  const value = isLocale(code) ? code : "";
  s.value.locale = value;
  setLocale(value || detectLocale());
  await setSetting("locale", value);
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
  savedTheme = s.value.theme;
  toast(t("settings.saved"), "ok");
}

async function exportNow() {
  try {
    await saveJson(`revisions_export_${new Date().toISOString().slice(0, 10)}.json`, await exportAllData());
    s.value.lastExportAt = Date.now();
    await setSetting("lastExportAt", s.value.lastExportAt);
    toast(t("settings.exported"), "ok");
  } catch (e) {
    toast(t("services.exportError", { error: e instanceof Error ? e.message : String(e) }), "danger");
  }
}

/** Clears content and progress but keeps the settings (language, theme…). */
async function resetAll() {
  if (!(await confirmDialog(t("settings.resetConfirm"), { confirmLabel: t("settings.resetAll") }))) return;
  const tables = db.tables.filter((tb) => tb.name !== "settings");
  await db.transaction("rw", tables, async () => {
    await Promise.all(tables.map((tb) => tb.clear()));
  });
  toast(t("settings.resetDone"), "ok");
}

// Preview the theme immediately.
watch(() => s.value.theme, (th) => { if (loaded.value) applyTheme(th); });

onMounted(load);
// Leaving without saving: drop the theme preview.
onUnmounted(() => applyTheme(savedTheme));
</script>

<template>
  <div class="page flex justify-center">
    <div class="card cardFill w-full max-w-[640px]">
      <div class="scrollY">
        <h2>{{ $t("settings.title") }}</h2>

        <h3 class="mt-3">{{ $t("settings.language") }}</h3>
        <select class="input" :value="s.locale" aria-label="Language" @change="changeLanguage(($event.target as HTMLSelectElement).value)">
          <option value="">🌐 Auto ({{ LOCALES[detectLocale()].name }})</option>
          <option v-for="l in languages" :key="l.code" :value="l.code">{{ l.name }}</option>
        </select>
        <p class="small">{{ LOCALES[locale].name }}</p>

        <h3 class="mt-3">{{ $t("settings.srs") }}</h3>
        <label class="small">{{ $t("settings.newPerDay") }}</label>
        <input class="input" type="number" min="0" max="500" v-model.number="s.newPerDay" />
        <p class="small">{{ $t("settings.newPerDayHint") }}</p>

        <h3 class="mt-3">{{ $t("settings.goal") }}</h3>
        <label class="small">{{ $t("settings.goalLabel") }}</label>
        <input class="input" type="number" min="1" max="2000" v-model.number="s.dailyGoal" />

        <h3 class="mt-3">{{ $t("settings.appearance") }}</h3>
        <div class="pills">
          <button type="button" class="pill" :class="{ active: s.theme === 'dark' }" @click="s.theme = 'dark'">{{ $t("settings.dark") }}</button>
          <button type="button" class="pill" :class="{ active: s.theme === 'light' }" @click="s.theme = 'light'">{{ $t("settings.light") }}</button>
          <button type="button" class="pill" :class="{ active: s.theme === 'system' }" @click="s.theme = 'system'">{{ $t("settings.system") }}</button>
        </div>

        <template v-if="canSpeak">
          <h3 class="mt-3">{{ $t("settings.audio") }}</h3>
          <label class="badge cursor-pointer">
            <input type="checkbox" v-model="s.autoSpeak" />
            {{ $t("settings.autoSpeak") }}
          </label>
        </template>

        <h3 class="mt-3">{{ $t("settings.backup") }}</h3>
        <p class="small">
          {{ $t("settings.lastExport") }}
          <b class="text-text">{{ s.lastExportAt ? formatDate(s.lastExportAt) : $t("settings.never") }}</b>.
          {{ $t("settings.backupHint") }}
        </p>
        <button class="btn" type="button" @click="exportNow">⬇️ {{ $t("settings.exportNow") }}</button>

        <div class="hr"></div>
        <div class="row">
          <button class="btn ok" @click="save">{{ $t("common.save") }}</button>
          <router-link class="btn" to="/">{{ $t("common.back") }}</router-link>
        </div>

        <section class="mt-6 rounded-xl border border-danger/40 p-4" aria-labelledby="danger-title">
          <h3 id="danger-title" class="text-danger">{{ $t("settings.danger") }}</h3>
          <p class="small">{{ $t("settings.resetHint") }}</p>
          <button class="btn danger" type="button" @click="resetAll">{{ $t("settings.resetAll") }}</button>
        </section>
      </div>
    </div>
  </div>
</template>
