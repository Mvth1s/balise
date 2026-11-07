<script setup lang="ts">
/**
 * Balise symbol (docs/charte/logos/balise-symbole.svg). The green background
 * is fixed (#0E5C4A) in both themes, as required by the charter: the amber
 * check would not be readable on the light green of the dark theme.
 * Decorative by default; pass `label` when the symbol is alone.
 */
withDefaults(
  defineProps<{ size?: number; label?: string; animated?: boolean; paused?: boolean }>(),
  { size: 40, label: '', animated: false, paused: false },
);
</script>

<template>
  <svg
    class="balise-symbol"
    :class="{ 'balise-symbol--animated': animated, 'balise-symbol--paused': paused }"
    :width="size"
    :height="size"
    viewBox="0 0 64 64"
    xmlns="http://www.w3.org/2000/svg"
    :role="label ? 'img' : undefined"
    :aria-label="label || undefined"
    :aria-hidden="label ? undefined : 'true'"
    focusable="false"
  >
    <rect width="64" height="64" rx="16" fill="#0E5C4A" />
    <path
      class="balise-symbol__arc"
      d="M19.3 44.7A18 18 0 1 1 44.7 44.7"
      pathLength="100"
      fill="none"
      stroke="#FAF8F4"
      stroke-width="5.5"
      stroke-linecap="round"
    />
    <path
      d="M24 33l6 6 11-13"
      fill="none"
      stroke="#E8A33D"
      stroke-width="5.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>

<style scoped>
.balise-symbol {
  flex: none;
  display: block;
}

/* Looping gauge (analysis screen); paused by its button, off when motion is reduced. */
@media (prefers-reduced-motion: no-preference) {
  html[data-motion='on'] .balise-symbol--animated .balise-symbol__arc {
    stroke-dasharray: 100;
    animation: balise-gauge 1600ms ease-in-out infinite alternate;
  }

  html[data-motion='on'] .balise-symbol--paused .balise-symbol__arc {
    animation-play-state: paused;
  }
}

@keyframes balise-gauge {
  from {
    stroke-dashoffset: 100;
  }

  to {
    stroke-dashoffset: 0;
  }
}

@media (forced-colors: active) {
  .balise-symbol rect {
    fill: Canvas;
    stroke: CanvasText;
  }
}
</style>
