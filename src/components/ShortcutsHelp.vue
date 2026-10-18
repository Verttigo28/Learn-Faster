<script setup lang="ts">
/**
 * Global keyboard shortcuts + their help overlay.
 * "?" toggles the help; g h / g r / g s navigate (two-key sequences, like GitHub).
 */
import { onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import BaseModal from "./BaseModal.vue";

const open = ref(false);
const router = useRouter();
let pendingG = 0;

function typing(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
}

function onKeydown(e: KeyboardEvent) {
  if (typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === "?") {
    e.preventDefault();
    open.value = !open.value;
    return;
  }
  if (e.key === "g") {
    pendingG = Date.now();
    return;
  }
  if (Date.now() - pendingG < 1000) {
    const to = { h: "/", r: "/review", s: "/search" }[e.key];
    pendingG = 0;
    if (to) router.push(to);
  }
}

defineExpose({ toggle: () => (open.value = !open.value) });

onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => window.removeEventListener("keydown", onKeydown));

const groups = [
  { title: "shortcuts.everywhere", rows: [["?", "shortcuts.help"], ["g h", "shortcuts.goHome"], ["g r", "shortcuts.goReview"], ["g s", "shortcuts.goSearch"]] },
  { title: "shortcuts.flashcards", rows: [["Space", "shortcuts.flip"], ["1 2 3 4", "shortcuts.grade"]] },
  { title: "shortcuts.sessions", rows: [["1–9", "shortcuts.pick"], ["Enter", "shortcuts.check"], ["← →", "shortcuts.navigate"]] }
];
</script>

<template>
  <BaseModal :open="open" :title="$t('shortcuts.title')" @close="open = false">
    <div v-for="g in groups" :key="g.title" class="mb-4 last:mb-0">
      <h3>{{ $t(g.title) }}</h3>
      <dl class="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 items-center">
        <template v-for="[keys, label] in g.rows" :key="label">
          <dt class="flex gap-1">
            <kbd v-for="k in keys.split(' ')" :key="k" class="kbd">{{ k }}</kbd>
          </dt>
          <dd class="m-0 text-muted">{{ $t(label) }}</dd>
        </template>
      </dl>
    </div>
  </BaseModal>
</template>
