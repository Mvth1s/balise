<script setup lang="ts">
import ReportDisplay from '@/components/report/ReportDisplay.vue';
import { usePageMeta } from '@/composables/usePageMeta';
import { DEMO_LABELS, DEMO_REPORTS, type DemoVariant } from '@/lib/demo-reports';

const props = defineProps<{ variant: DemoVariant }>();
const report = DEMO_REPORTS[props.variant];
const label = DEMO_LABELS[props.variant];

usePageMeta({
  title: `Rapport d’exemple : ${label}`,
  description: `Rapport de pré-diagnostic RGAA produit par Balise sur la page de démonstration (${label}) : scores indicatifs, erreurs détectées et critères à vérifier manuellement.`,
});
</script>

<template>
  <div>
    <div class="container example-context">
      <p class="small">
        Rapport pré-calculé sur la
        <RouterLink :to="`/demo/${variant}`">page de démonstration ({{ label }})</RouterLink>.
        <RouterLink to="/exemple">Comparer avant et après correction</RouterLink>
      </p>
    </div>
    <ReportDisplay :key="variant" :report="report" :heading="`Rapport d’exemple : ${label}`" />
  </div>
</template>

<style scoped>
.example-context {
  padding-top: var(--space-6);
}
</style>
