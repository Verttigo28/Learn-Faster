<script setup lang="ts">
import { answerConfirm, dialogState, dismissToast } from "../services/dialog";
import BaseModal from "./BaseModal.vue";
</script>

<template>
  <BaseModal :open="!!dialogState.confirm" title="Confirmation" @close="answerConfirm(false)">
    <p class="m-0">{{ dialogState.confirm?.message }}</p>
    <div class="row mt-3 justify-end">
      <button class="btn" @click="answerConfirm(false)">Annuler</button>
      <button class="btn" :class="dialogState.confirm?.danger ? 'danger' : 'ok'" @click="answerConfirm(true)">
        {{ dialogState.confirm?.confirmLabel }}
      </button>
    </div>
  </BaseModal>

  <teleport to="body">
    <div class="toastStack" aria-live="polite">
      <div
        v-for="t in dialogState.toasts"
        :key="t.id"
        class="toast"
        :class="t.kind"
        role="status"
        @click="dismissToast(t.id)"
      >
        {{ t.text }}
      </div>
    </div>
  </teleport>
</template>
