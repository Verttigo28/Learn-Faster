<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  current: number;
  total: number;
}>();

const percent = computed(() => {
  if (!props.total) return 0;
  return Math.round((props.current / props.total) * 100);
});
</script>

<template>
  <div
    class="progress-bar-container"
    role="progressbar"
    :aria-valuenow="current"
    :aria-valuemin="0"
    :aria-valuemax="total"
    :aria-label="`Progression : ${percent}%`"
  >
    <div class="progress-bar-fill" :style="{ width: percent + '%' }"></div>
  </div>
</template>

<style scoped>
.progress-bar-container {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: rgb(var(--border) / 0.1);
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  border-radius: 3px;
  background: rgb(var(--accent));
  transition: width 0.3s ease;
}
</style>
