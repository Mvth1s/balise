<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { canAnimate, countUp } from '@/lib/animate';
import { tierFor } from '@/lib/tiers';

/**
 * Score gauge: arc open at the bottom, like the Balise symbol. The SVG is a
 * single image whose accessible name carries the full information
 * (score, tier, coverage); the visible tier label and icon sit next to it.
 */
const props = withDefaults(
  defineProps<{
    score: number | null;
    /** Full accessible name, e.g. "Images : 78 sur 100, palier À corriger, 4 critères testés sur 9". */
    label: string;
    size?: number;
    /** Shows "sur 100" under the number. */
    suffix?: boolean;
  }>(),
  { size: 64, suffix: false },
);

const ARC = 'M26.06 93.94A48 48 0 1 1 93.94 93.94';
const shown = ref(props.score ?? 0);
const tone = computed(() => tierFor(props.score));
let cancel: () => void = () => undefined;

onMounted(() => {
  if (props.score === null || !canAnimate()) return;
  shown.value = 0;
  cancel = countUp(0, props.score, 400 + props.score * 4, (v) => (shown.value = v));
});
onBeforeUnmount(() => cancel());
</script>

<template>
  <svg
    class="gauge"
    :class="`tone-${tone}`"
    :width="size"
    :height="size"
    viewBox="0 0 120 120"
    role="img"
    :aria-label="label"
    focusable="false"
  >
    <path class="gauge__track" :d="ARC" pathLength="100" />
    <path
      v-if="score !== null"
      class="gauge__value"
      :d="ARC"
      pathLength="100"
      :stroke-dasharray="`${shown} 100`"
    />
    <text x="60" :y="suffix ? 68 : 72" text-anchor="middle" class="gauge__number">
      {{ score === null ? '–' : shown }}
    </text>
    <text v-if="suffix && score !== null" x="60" y="86" text-anchor="middle" class="gauge__suffix">
      sur 100
    </text>
  </svg>
</template>

<style scoped>
.gauge {
  flex: none;
  display: block;
}

.gauge path {
  fill: none;
  stroke-width: 11;
  stroke-linecap: round;
}

.gauge__track {
  stroke: var(--color-border);
}

.gauge__value {
  stroke: currentColor;
}

.gauge__number {
  fill: var(--color-ink);
  font-family: var(--font-sans);
  font-size: 34px;
  font-weight: 800;
}

.gauge__suffix {
  fill: var(--color-ink-muted);
  font-family: var(--font-sans);
  font-size: 10px;
}

@media (forced-colors: active) {
  .gauge__track {
    stroke: GrayText;
  }

  .gauge__value {
    stroke: CanvasText;
  }

  .gauge__number,
  .gauge__suffix {
    fill: CanvasText;
  }
}
</style>
