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

<style scoped>
.modal-backdrop{
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.55);
  display:flex;
  align-items:center;
  justify-content:center;
  padding: 16px;
  z-index: 9999;
}
.modal-card{
  width: min(760px, 100%);
  border-radius: 18px;
  border: 1px solid var(--border);
  background: rgba(17,26,51,.92);
  backdrop-filter: blur(10px);
  padding: 14px;
}
.modal-header{
  display:flex;
  gap: 10px;
  align-items:center;
  justify-content:space-between;
  margin-bottom: 10px;
}
.modal-title{ margin:0; }
.modal-body{ color: var(--text); }
</style>
