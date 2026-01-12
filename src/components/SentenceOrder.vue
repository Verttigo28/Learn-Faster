<script setup lang="ts">
/**
 * Exercice: remettre les mots dans le bon ordre.
 * - Clique dans "Mots" => ajoute à "Ta réponse"
 * - Clique un mot dans "Ta réponse" => l'enlève
 *
 * IMPORTANT: modelValue peut être undefined au premier render => fallback [].
 */
import { computed } from "vue";
import { shuffleTokens } from "../utils/sentence";

const props = defineProps<{
  tokens: string[];
  modelValue?: string[];
}>();

const emit = defineEmits<{
  (e: "update:modelValue", v: string[]): void;
}>();

const answer = computed(() => props.modelValue ?? []);

const remaining = computed(() => {
  const used = answer.value.slice();
  const usedCount = new Map<string, number>();
  for (const u of used) usedCount.set(u, (usedCount.get(u) ?? 0) + 1);

  const all = shuffleTokens(props.tokens);
  const seenCount = new Map<string, number>();
  const rem: string[] = [];

  for (const t of all) {
    seenCount.set(t, (seenCount.get(t) ?? 0) + 1);
    const haveUsed = usedCount.get(t) ?? 0;
    const seen = seenCount.get(t) ?? 0;
    if (seen > haveUsed) rem.push(t);
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
  <div class="card" style="border-radius: 18px;">
    <div class="small" style="margin-bottom:8px;">Mets les mots dans le bon ordre (S-P-O-K).</div>

    <div class="small">Ta réponse</div>
    <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">
      <button v-for="(t, i) in answer" :key="i" class="btn" @click="unpick(i)" style="padding:8px 10px;">
        {{ t }}
      </button>
      <span v-if="answer.length === 0" class="small">Clique les mots ci-dessous…</span>
    </div>

    <div class="hr"></div>

    <div class="small">Mots (désordre)</div>
    <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">
      <button v-for="(t, i) in remaining" :key="i" class="btn" @click="pick(t)" style="padding:8px 10px;">
        {{ t }}
      </button>
    </div>
  </div>
</template>
