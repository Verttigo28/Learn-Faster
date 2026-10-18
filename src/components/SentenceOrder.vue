<script setup lang="ts">
/**
 * Exercice: remettre les mots dans le bon ordre.
 * - Clique dans "Mots" => ajoute à "Ta réponse"
 * - Clique un mot dans "Ta réponse" => l'enlève
 *
 * IMPORTANT: modelValue peut être undefined au premier render => fallback [].
 * Le mélange est fait une seule fois par phrase (sinon les mots bougent à chaque clic).
 */
import { computed, ref, watch } from "vue";
import { shuffleTokens } from "../utils/sentence";

const props = defineProps<{
  tokens: string[];
  modelValue?: string[];
}>();

const emit = defineEmits<{
  (e: "update:modelValue", v: string[]): void;
}>();

const answer = computed(() => props.modelValue ?? []);

const shuffled = ref<string[]>([]);
watch(
  () => props.tokens,
  (tokens) => { shuffled.value = shuffleTokens(tokens); },
  { immediate: true }
);

/** Mots restants, dans l'ordre mélangé figé (chaque occurrence n'est retirée qu'une fois). */
const remaining = computed(() => {
  const usedCount = new Map<string, number>();
  for (const u of answer.value) usedCount.set(u, (usedCount.get(u) ?? 0) + 1);

  const rem: string[] = [];
  for (const t of shuffled.value) {
    const left = usedCount.get(t) ?? 0;
    if (left > 0) usedCount.set(t, left - 1);
    else rem.push(t);
  }
  return rem;
});

function pick(token: string) {
  emit("update:modelValue", [...answer.value, token]);
}
function unpick(index: number) {
  const next = answer.value.slice();
  next.splice(index, 1);
  emit("update:modelValue", next);
}
</script>

<template>
  <div class="card">
    <div class="small mb-2">{{ $t("practice.order.instruction") }}</div>

    <div class="small">{{ $t("practice.order.yourAnswer") }}</div>
    <div class="flex flex-wrap gap-2 mt-2">
      <button v-for="(t, i) in answer" :key="i" class="btn" @click="unpick(i)" >
        {{ t }}
      </button>
      <span v-if="answer.length === 0" class="small">{{ $t("practice.order.clickWords") }}</span>
    </div>

    <div class="hr"></div>

    <div class="small">{{ $t("practice.order.shuffled") }}</div>
    <div class="flex flex-wrap gap-2 mt-2">
      <button v-for="(t, i) in remaining" :key="i" class="btn" @click="pick(t)" >
        {{ t }}
      </button>
    </div>
  </div>
</template>
