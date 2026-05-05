<script setup lang="ts">
defineProps<{
  message: string;
  kind?: "info" | "ok" | "danger";
}>();
</script>

<template>
  <div class="confirm-bar" :class="'confirm-bar--' + (kind || 'info')">
    <p class="m-0">{{ message }}</p>
  </div>
</template>

<style scoped>
.confirm-bar {
  border-radius: 1rem;
  border: 1px solid rgb(var(--border) / 0.1);
  background: rgb(var(--card) / 0.7);
  padding: 0.75rem 1rem;
  transition: border-color 0.2s ease;
}
.confirm-bar--ok { border-color: rgb(var(--ok) / 0.4); }
.confirm-bar--danger { border-color: rgb(var(--danger) / 0.4); }
.confirm-bar--info { border-color: rgb(var(--accent) / 0.3); }
</style>
