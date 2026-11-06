<script setup lang="ts">
import { Check, Eye, Minus, TriangleAlert, X } from '@lucide/vue';
import { computed } from 'vue';
import type { TierIcon } from '@/lib/tiers';

/** Decorative status icon: always placed next to a text label. */
const props = withDefaults(defineProps<{ icon: TierIcon | 'dash'; size?: number }>(), {
  size: 16,
});

const component = computed(
  () => ({ check: Check, triangle: TriangleAlert, cross: X, eye: Eye, dash: Minus })[props.icon],
);
const stroke = computed(() => (props.icon === 'check' || props.icon === 'cross' ? 2.5 : 2));
</script>

<template>
  <component
    :is="component"
    :size="size"
    :stroke-width="stroke"
    aria-hidden="true"
    focusable="false"
  />
</template>
