<script setup lang="ts">
defineProps<{
  message: string;
  kind?: "info" | "ok" | "danger";
}>();
</script>

<template>
  <div class="card" :style="kind === 'ok' ? 'border-color: rgba(61,220,151,.35)' : kind === 'danger' ? 'border-color: rgba(255,107,107,.35)' : ''">
    <p style="margin:0">{{ message }}</p>
  </div>
</template>
