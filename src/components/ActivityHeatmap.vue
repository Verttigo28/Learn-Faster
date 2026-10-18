<script setup lang="ts">
/**
 * GitHub-style activity calendar: columns = weeks (oldest first), rows = Monday..Sunday.
 * Single-hue sequential ramp (accent) in 5 steps; per-cell tooltip on hover / keyboard focus;
 * a text summary below so color is never the only cue.
 */
import { computed, ref } from "vue";
import type { Attempt } from "../db";
import { bestStreak, heatLevel, heatmapWeeks, type HeatCell } from "../services/stats";
import { intlLocale, t } from "../i18n";

const props = withDefaults(defineProps<{ attempts: Attempt[]; weeks?: number }>(), { weeks: 20 });

const grid = computed(() => heatmapWeeks(props.attempts, props.weeks));
const cells = computed(() => grid.value.flat().filter((c) => !c.future));
const max = computed(() => Math.max(0, ...cells.value.map((c) => c.answers)));
const total = computed(() => cells.value.reduce((acc, c) => acc + c.answers, 0));
const activeDays = computed(() => cells.value.filter((c) => c.answers > 0).length);
const best = computed(() => bestStreak(props.attempts));

/** Short weekday names, Monday first (2024-01-01 was a Monday). */
const weekdays = computed(() => {
  const fmt = new Intl.DateTimeFormat(intlLocale(), { weekday: "short" });
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2024, 0, 1 + i, 12)));
});

/** Month label above the first column of each month. */
const months = computed(() => {
  const fmt = new Intl.DateTimeFormat(intlLocale(), { month: "short" });
  let prev = -1;
  const labels = grid.value.map((col) => {
    const m = new Date(col[0].date).getMonth();
    const label = m !== prev ? fmt.format(new Date(col[0].date)) : "";
    prev = m;
    return label;
  });
  // The first (partial) month would collide with the next label: drop it.
  if (labels[1] || labels[2]) labels[0] = "";
  return labels;
});

function dateLabel(c: HeatCell) {
  return new Date(c.date).toLocaleDateString(intlLocale(), { day: "numeric", month: "short" });
}
function cellLabel(c: HeatCell) {
  return t("stats.heatmap.cell", { count: c.answers, date: dateLabel(c) });
}

// --- hover / keyboard focus -------------------------------------------------
const wrap = ref<HTMLElement | null>(null);
const active = ref<{ w: number; d: number } | null>(null);
const tipPos = ref({ left: 0, top: 0 });
const activeCell = computed(() => (active.value ? grid.value[active.value.w]?.[active.value.d] : null));

function show(w: number, d: number, el?: Element | null) {
  const c = grid.value[w]?.[d];
  if (!c || c.future) return;
  active.value = { w, d };
  const target = el ?? wrap.value?.querySelector(`[data-cell="${w}-${d}"]`);
  if (target && wrap.value) {
    const r = target.getBoundingClientRect();
    const base = wrap.value.getBoundingClientRect();
    const left = r.left - base.left + r.width / 2;
    tipPos.value = { left: Math.min(Math.max(left, 70), base.width - 70), top: r.top - base.top };
  }
}
function hide() {
  active.value = null;
}

function lastCell(): { w: number; d: number } {
  for (let w = grid.value.length - 1; w >= 0; w--) {
    for (let d = 6; d >= 0; d--) if (!grid.value[w][d].future) return { w, d };
  }
  return { w: 0, d: 0 };
}

function onKey(e: KeyboardEvent) {
  const moves: Record<string, [number, number]> = {
    ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]
  };
  if (e.key === "Escape") return hide();
  const mv = moves[e.key];
  if (!mv) return;
  e.preventDefault();
  const cur = active.value ?? lastCell();
  const w = Math.min(grid.value.length - 1, Math.max(0, cur.w + mv[0]));
  const d = Math.min(6, Math.max(0, cur.d + mv[1]));
  show(w, d);
}
</script>

<template>
  <figure class="m-0">
    <figcaption class="small mb-2">{{ $t("stats.heatmap.caption", { weeks }) }}</figcaption>

    <div
      ref="wrap"
      class="heatWrap"
      tabindex="0"
      role="group"
      :aria-label="$t('stats.heatmap.aria', { weeks, total })"
      @keydown="onKey"
      @focus="show(lastCell().w, lastCell().d)"
      @blur="hide"
      @mouseleave="hide"
    >
      <div class="heatGrid" :style="{ gridTemplateColumns: `auto repeat(${grid.length}, minmax(0, 1fr))` }">
        <!-- month row -->
        <span></span>
        <span v-for="(m, w) in months" :key="`m-${w}`" class="heatMonth">{{ m }}</span>

        <!-- one grid row per weekday -->
        <template v-for="d in 7" :key="`r-${d}`">
          <span class="heatDay">{{ d === 1 || d === 3 || d === 5 ? weekdays[d - 1] : "" }}</span>
          <span
            v-for="(col, w) in grid"
            :key="col[d - 1].key"
            class="heatCell"
            :class="col[d - 1].future ? 'future' : `l${heatLevel(col[d - 1].answers, max)}`"
            :data-cell="`${w}-${d - 1}`"
            :aria-label="col[d - 1].future ? undefined : cellLabel(col[d - 1])"
            :aria-hidden="col[d - 1].future ? 'true' : undefined"
            :data-active="active && active.w === w && active.d === d - 1 ? '' : undefined"
            @mouseenter="show(w, d - 1, $event.currentTarget as Element)"
            @click="show(w, d - 1, $event.currentTarget as Element)"
          ></span>
        </template>
      </div>

      <div v-if="activeCell" class="chartTooltip heatTip" :style="{ left: `${tipPos.left}px`, top: `${tipPos.top}px` }" aria-live="polite">
        <b>{{ dateLabel(activeCell) }}</b><br />
        {{ $t("stats.chart.answers", { count: activeCell.answers }) }}<span v-if="activeCell.answers"> • {{ $t("stats.chart.correctPct", { pct: Math.round((activeCell.correct / activeCell.answers) * 100) }) }}</span>
      </div>
    </div>

    <div class="heatFoot">
      <p class="small m-0">
        {{ $t("stats.heatmap.bestStreak", { count: best }) }} • {{ $t("stats.chart.activeDays", { count: activeDays }) }} • {{ $t("stats.chart.total", { count: total }) }}
      </p>
      <div class="heatLegend small" aria-hidden="true">
        <span>{{ $t("stats.heatmap.less") }}</span>
        <span v-for="l in 5" :key="l" class="heatCell legend" :class="`l${l - 1}`"></span>
        <span>{{ $t("stats.heatmap.more") }}</span>
      </div>
    </div>
  </figure>
</template>

<style scoped>
.heatWrap {
  position: relative;
  max-width: 560px;
  border-radius: 8px;
}
.heatGrid {
  display: grid;
  gap: 3px;
  align-items: center;
}
.heatMonth {
  font-size: 11px;
  color: rgb(var(--muted));
  white-space: nowrap;
  overflow: visible;
  width: 0;
  line-height: 1.6;
}
.heatDay {
  font-size: 10.5px;
  color: rgb(var(--muted));
  padding-right: 4px;
  white-space: nowrap;
  line-height: 1;
}
.heatCell {
  display: block;
  aspect-ratio: 1;
  border-radius: 3px;
  background: rgb(var(--border) / .07);
  box-shadow: inset 0 0 0 1px rgb(var(--border) / .06);
}
.heatCell.l1 { background: rgb(var(--accent) / .3); box-shadow: none; }
.heatCell.l2 { background: rgb(var(--accent) / .52); box-shadow: none; }
.heatCell.l3 { background: rgb(var(--accent) / .76); box-shadow: none; }
.heatCell.l4 { background: rgb(var(--accent)); box-shadow: none; }
.heatCell.future { background: transparent; box-shadow: none; }
.heatCell[data-active] { outline: 2px solid rgb(var(--text)); outline-offset: 1px; }
.heatTip {
  transform: translate(-50%, calc(-100% - 6px));
  z-index: 2;
}
.heatFoot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 6px 12px;
  margin-top: 10px;
}
.heatLegend {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.heatLegend .legend {
  width: 11px;
  height: 11px;
  aspect-ratio: auto;
}
.heatLegend > span:first-child { margin-right: 3px; }
.heatLegend > span:last-child { margin-left: 3px; }
</style>
