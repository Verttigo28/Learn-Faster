<script setup lang="ts">
import { answerConfirm, dialogState, dismissToast } from "../services/dialog";
import BaseModal from "./BaseModal.vue";
</script>

<template>
  <BaseModal :open="!!dialogState.confirm" :title="$t('services.confirmTitle')" @close="answerConfirm(false)">
    <p class="m-0">{{ dialogState.confirm?.message }}</p>
    <div class="row mt-3 justify-end">
      <button class="btn" @click="answerConfirm(false)">{{ $t("common.cancel") }}</button>
      <button class="btn" :class="dialogState.confirm?.danger ? 'danger' : 'ok'" @click="answerConfirm(true)">
        {{ dialogState.confirm?.confirmLabel }}
      </button>
    </div>
  </BaseModal>

  <teleport to="body">
    <div class="toastStack" aria-live="polite">
      <TransitionGroup name="toast">
        <div
          v-for="t in dialogState.toasts"
          :key="t.id"
          class="toast"
          :class="t.kind"
          role="status"
          @click="dismissToast(t.id)"
        >
          <span class="relative z-[1]">{{ t.text }}</span>
          <span class="toastProgress" :style="{ animationDuration: `${t.ms}ms` }"></span>
        </div>
      </TransitionGroup>
    </div>
  </teleport>
</template>
