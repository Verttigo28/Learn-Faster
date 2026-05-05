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
    <Transition name="modal">
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
    </Transition>
  </teleport>
</template>

<style scoped>
.modal-enter-active { transition: opacity 0.2s ease; }
.modal-leave-active { transition: opacity 0.15s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }

.modal-enter-active .modal-card { transition: transform 0.25s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s ease; }
.modal-leave-active .modal-card { transition: transform 0.15s ease, opacity 0.15s ease; }
.modal-enter-from .modal-card { transform: translateY(20px) scale(0.96); opacity: 0; }
.modal-leave-to .modal-card { transform: translateY(10px) scale(0.98); opacity: 0; }
</style>

