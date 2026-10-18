<script setup lang="ts">
/**
 * Bar chart: answers per day (single series => no legend, the title names it).
 * Thin bars with rounded tops anchored on the baseline, recessive grid, hover tooltip per bar.
 */
import { computed, ref } from "vue";
import type { DayActivity } from "../services/stats";

const props = defineProps<{ days: DayActivity[] }>();

const W = 600;
const H = 160;
const PAD = { top: 12, right: 8, bottom: 22, left: 30 };

const max = computed(() => Math.max(5, ...props.days.map((d) => d.answers)));
/** Round the axis max to a "nice" number. */
const niceMax = computed(() => {
  const m = max.value;
  const step = Math.pow(10, Math.floor(Math.log10(m)));
  return Math.ceil(m / step) * step;
});

const slot = computed(() => (W - PAD.left - PAD.right) / Math.max(1, props.days.length));
const barW = computed(() => Math.max(3, Math.min(14, slot.value - 4)));
const y = (v: number) => PAD.top + (H - PAD.top - PAD.bottom) * (1 - v / niceMax.value);

/** SVG path for a bar with 4px rounded top corners, flat on the baseline. */
function barPath(i: number, v: number): string {
  if (v <= 0) return "";
  const x = PAD.left + i * slot.value + (slot.value - barW.value) / 2;
  const top = y(v);
  const base = y(0);
  const r = Math.min(4, barW.value / 2, base - top);
  return `M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW.value - r} Q${x + barW.value},${top} ${x + barW.value},${top + r} V${base} Z`;
}

const hover = ref<number | null>(null);
const hovered = computed(() => (hover.value === null ? null : props.days[hover.value]));

function label(d: DayActivity) {
  return new Date(d.date).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

const ticks = computed(() => [0, niceMax.value / 2, niceMax.value]);
const total = computed(() => props.days.reduce((a, d) => a + d.answers, 0));
const activeDays = computed(() => props.days.filter((d) => d.answers > 0).length);
</script>

<template>
  <figure class="m-0">
    <figcaption class="small mb-2">
      Réponses par jour — {{ days.length }} derniers jours • {{ total }} réponses • {{ activeDays }} jour(s) actif(s)
    </figcaption>

    <div class="relative">
      <svg :viewBox="`0 0 ${W} ${H}`" class="w-full h-auto block" role="img" :aria-label="`Réponses par jour, total ${total}`">
        <g class="chartGrid">
          <template v-for="t in ticks" :key="t">
            <line :x1="PAD.left" :x2="W - PAD.right" :y1="y(t)" :y2="y(t)" />
            <text :x="PAD.left - 6" :y="y(t) + 4" text-anchor="end" class="chartAxisText">{{ t }}</text>
          </template>
        </g>

        <g>
          <path
            v-for="(d, i) in days"
            :key="d.key"
            :d="barPath(i, d.answers)"
            class="chartBar"
            :class="{ dim: hover !== null && hover !== i }"
          />
        </g>

        <!-- hit targets bigger than the marks -->
        <rect
          v-for="(d, i) in days"
          :key="`hit-${d.key}`"
          :x="PAD.left + i * slot"
          :y="PAD.top"
          :width="slot"
          :height="H - PAD.top - PAD.bottom"
          fill="transparent"
          @mouseenter="hover = i"
          @mouseleave="hover = null"
          @click="hover = hover === i ? null : i"
        />

        <text :x="PAD.left" :y="H - 6" class="chartAxisText">{{ days.length ? label(days[0]) : "" }}</text>
        <text :x="W - PAD.right" :y="H - 6" text-anchor="end" class="chartAxisText">Aujourd'hui</text>
      </svg>

      <div
        v-if="hovered && hover !== null"
        class="chartTooltip"
        :style="{ left: `${((PAD.left + (hover + 0.5) * slot) / W) * 100}%` }"
      >
        <b>{{ label(hovered) }}</b><br />
        {{ hovered.answers }} réponse(s)<span v-if="hovered.answers"> • {{ Math.round((hovered.correct / hovered.answers) * 100) }}% justes</span>
      </div>
    </div>
  </figure>
</template>
