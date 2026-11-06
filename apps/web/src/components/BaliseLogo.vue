<script setup lang="ts">
import BaliseSymbol from './BaliseSymbol.vue';

/**
 * Horizontal logo: symbol (SVG) + the word "Balise" as HTML text, so that it
 * uses the self-hosted font and follows the theme colour.
 */
withDefaults(defineProps<{ size?: number }>(), { size: 40 });
</script>

<template>
  <span class="balise-logo">
    <BaliseSymbol :size="size" />
    <span class="balise-logo__word">Balise</span>
  </span>
</template>

<style scoped>
.balise-logo {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  color: var(--color-ink);
}

.balise-logo__word {
  font-family: var(--font-sans);
  font-size: var(--text-h2-size);
  line-height: 1;
  font-weight: 800;
  letter-spacing: -0.02em;
}
</style>
