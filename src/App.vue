<script setup lang="ts">
import { useRoute } from "vue-router";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import AppDialogs from "./components/AppDialogs.vue";
import ShortcutsHelp from "./components/ShortcutsHelp.vue";
import { ref } from "vue";
import { getSetting } from "./services/settings";
import { applyTheme } from "./services/theme";
import { detectLocale, isLocale, locale, setLocale } from "./i18n";

const route = useRoute();
const shortcuts = ref<InstanceType<typeof ShortcutsHelp> | null>(null);
function isActive(path: string) {
  return route.path === path || route.path.startsWith(path + "/");
}

const links = [
  { to: "/", key: "nav.home" },
  { to: "/import", key: "nav.import" },
  { to: "/vocab", key: "nav.vocab" },
  { to: "/qcm", key: "nav.qcm" },
  { to: "/sentences", key: "nav.sentences" },
  { to: "/exams", key: "nav.exams" },
  { to: "/stats", key: "nav.stats" }
];

async function enableFullscreen() {
  if (!Capacitor.isNativePlatform()) return;

  // ✅ Cache la barre de statut
  await StatusBar.hide();

  // Optionnel: si tu la réaffiches un jour
  await StatusBar.setStyle({ style: Style.Dark });
}

enableFullscreen().catch(console.error);
getSetting("theme").then(applyTheme).catch(console.error);
setLocale(locale.value);
getSetting("locale")
  .then((l) => setLocale(isLocale(l) ? l : detectLocale()))
  .catch(console.error);
</script>

<template>
  <div class="appShell">
    <header class="nav">
      <div class="left">
        <router-link to="/" class="brand" :aria-label="$t('nav.home')">
          <span class="brandMark" aria-hidden="true">LF</span>
          <span class="brandName">{{ $t("nav.brand") }}</span>
        </router-link>
        <nav class="pills navPills">
          <router-link
            v-for="l in links"
            :key="l.to"
            :to="l.to"
            class="pill"
            :class="{ active: l.to === '/' ? route.path === '/' : isActive(l.to) }"
          >{{ $t(l.key) }}</router-link>
          <router-link to="/search" class="pill" :class="{ active: isActive('/search') }" :title="$t('nav.search')" :aria-label="$t('nav.search')">🔍</router-link>
          <router-link to="/settings" class="pill" :class="{ active: isActive('/settings') }" :title="$t('nav.settings')" :aria-label="$t('nav.settings')">⚙️</router-link>
        </nav>
      </div>
      <div class="flex items-center gap-3">
        <button class="pill hidden tablet:inline-flex" type="button" :title="$t('shortcuts.open')" :aria-label="$t('shortcuts.open')" @click="shortcuts?.toggle()">?</button>
        <span class="small poweredBy">{{ $t("nav.poweredBy") }}</span>
      </div>
    </header>

    <main class="appMain">
      <div class="container appContainer">
        <router-view />
      </div>
    </main>

    <AppDialogs />
    <ShortcutsHelp ref="shortcuts" />
  </div>
</template>
