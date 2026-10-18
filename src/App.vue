<script setup lang="ts">
import { useRoute } from "vue-router";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import AppDialogs from "./components/AppDialogs.vue";

const route = useRoute();
function isActive(path: string) {
  return route.path === path || route.path.startsWith(path + "/");
}

async function enableFullscreen() {
  if (!Capacitor.isNativePlatform()) return;

  // ✅ Cache la barre de statut
  await StatusBar.hide();

  // Optionnel: si tu la réaffiches un jour
  await StatusBar.setStyle({ style: Style.Dark });
}

enableFullscreen().catch(console.error);
</script>

<template>
  <div class="appShell">
    <header class="nav">
      <div class="left">
        <p class="brand">Learn faster !</p>
        <div class="pills">
          <router-link to="/" class="pill" :class="{ active: isActive('/') }">Accueil</router-link>
          <router-link to="/import" class="pill" :class="{ active: isActive('/import') }">Import</router-link>
          <router-link to="/vocab" class="pill" :class="{ active: isActive('/vocab') }">Vocab</router-link>
          <router-link to="/qcm" class="pill" :class="{ active: isActive('/qcm') }">QCM</router-link>
          <router-link to="/sentences" class="pill" :class="{ active: isActive('/sentences') }">Phrases</router-link>
          <router-link to="/exams" class="pill" :class="{ active: isActive('/exams') }">Exams</router-link>
          <router-link to="/stats" class="pill" :class="{ active: isActive('/stats') }">Stats</router-link>
        </div>
      </div>
      <span class="small">Powered by Altera</span>
    </header>

    <main class="appMain">
      <div class="container appContainer">
        <router-view />
      </div>
    </main>

    <AppDialogs />
  </div>
</template>
