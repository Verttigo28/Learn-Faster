<script setup lang="ts">
defineProps<{ title: string; hint?: string; icon?: string }>();
</script>

<template>
  <div class="empty-state">
    <div class="empty-icon">{{ icon || "📭" }}</div>
    <h3 class="empty-title">{{ title }}</h3>
    <p v-if="hint" class="empty-hint">{{ hint }}</p>
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 2rem 1rem;
  gap: 0.25rem;
}

.empty-icon {
  font-size: 2.5rem;
  line-height: 1;
  margin-bottom: 0.5rem;
  opacity: 0.7;
}

.empty-title {
  margin: 0;
  font-size: 1.1rem;
  color: rgb(var(--text));
}

.empty-hint {
  margin: 0.25rem 0 0;
  font-size: 0.85rem;
  color: rgb(var(--muted));
  max-width: 280px;
}
</style>
