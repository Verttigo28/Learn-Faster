<script setup lang="ts">
/**
 * Modal simple et réutilisable.
 * - remplace alert()
 * - ferme via bouton, clic backdrop, ou touche Escape
 */
import { onMounted, onUnmounted } from "vue";

const props = defineProps<{
  open: boolean;
  title?: string;
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

function onBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) emit("close");
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && props.open) emit("close");
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <teleport to="body">
    <div v-if="open" class="modal-backdrop" @click="onBackdropClick">
      <div class="modal-card" role="dialog" aria-modal="true">
        <div class="modal-header">
          <h3 class="modal-title">{{ title || "Résultat" }}</h3>
          <button class="btn" @click="$emit('close')">Fermer</button>
        </div>
        <div class="modal-body">
          <slot />
        </div>
      </div>
    </div>
  </teleport>
</template>

