<script setup lang="ts">
defineProps<{
  open: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}>();

const emit = defineEmits<{
  (e: "confirm"): void;
  (e: "cancel"): void;
}>();
</script>

<template>
  <Teleport to="body">
    <Transition name="confirm">
      <div v-if="open" class="modal-backdrop" @click.self="emit('cancel')">
        <div class="modal confirm-modal">
          <div class="modal-header">
            <h3 class="modal-title">{{ title || "Confirmer" }}</h3>
          </div>
          <p class="mt-2 mb-4">{{ message }}</p>
          <div class="row">
            <button class="btn" @click="emit('cancel')">{{ cancelText || "Annuler" }}</button>
            <button
              class="btn"
              :class="danger ? 'danger' : 'primary'"
              @click="emit('confirm')"
            >
              {{ confirmText || "Confirmer" }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.confirm-modal { max-width: 400px; }

.confirm-enter-active { transition: opacity 0.2s ease; }
.confirm-leave-active { transition: opacity 0.15s ease; }
.confirm-enter-from, .confirm-leave-to { opacity: 0; }

.confirm-enter-active .modal { transition: transform 0.25s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s ease; }
.confirm-leave-active .modal { transition: transform 0.15s ease, opacity 0.15s ease; }
.confirm-enter-from .modal { transform: translateY(20px) scale(0.96); opacity: 0; }
.confirm-leave-to .modal { transform: translateY(10px) scale(0.98); opacity: 0; }
</style>
