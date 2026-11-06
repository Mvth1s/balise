<script setup lang="ts">
import { computed } from 'vue';
import { tierInfo } from '@/lib/tiers';
import StatusIcon from './StatusIcon.vue';

/** Tier of a score: colour + icon + text (never colour alone). */
const props = defineProps<{ score: number | null }>();
const info = computed(() => tierInfo(props.score));
</script>

<template>
  <span class="tier-label" :class="`tone-${info.tier}`">
    <StatusIcon :icon="info.icon" />
    {{ info.label }}
  </span>
</template>

<style scoped>
.tier-label {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: 0.875rem;
  line-height: 1.25rem;
  font-weight: 700;
}
</style>
