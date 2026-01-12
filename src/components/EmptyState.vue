<script setup lang="ts">
defineProps<{ title: string; hint?: string }>();
</script>

<template>
  <div class="card">
    <h3>{{ title }}</h3>
    <p v-if="hint">{{ hint }}</p>
  </div>
</template>
