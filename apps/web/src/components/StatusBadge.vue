<script setup lang="ts">
import type { CriterionStatus } from '@balise/analyzer/types';
import { computed } from 'vue';
import { STATUS_INFO } from '@/lib/tiers';
import StatusIcon from './StatusIcon.vue';

const props = defineProps<{ status: CriterionStatus }>();
const info = computed(() => STATUS_INFO[props.status]);
const tone = computed(
  () =>
    ({
      'non-conforme': 'bad',
      'a-verifier': 'manual',
      conforme: 'good',
      'non-conforme-ia': 'bad',
      'conforme-ia': 'good',
      'non-applicable': 'neutral',
    })[props.status],
);
</script>

<template>
  <span class="badge" :class="[`tone-${tone}`, { 'badge--ai': status.endsWith('-ia') }]">
    <StatusIcon :icon="info.icon" :size="14" />
    {{ info.label }}
  </span>
</template>

<style scoped>
/* AI judgements: dashed border + sparkles icon + "(IA)" label, distinct from "(auto)". */
.badge--ai {
  border-style: dashed;
}
</style>
