<script setup lang="ts">
import { usePageMeta } from '@/composables/usePageMeta';
import { formatLongDate } from '@/lib/format';

/** Layout of the legal and information pages: breadcrumb, h1, date, prose. */
const props = defineProps<{
  title: string;
  /** ISO date of the last update ("2026-11-05"). */
  updated?: string;
  description?: string;
}>();

usePageMeta({
  title: () => props.title,
  description: () => props.description ?? `${props.title} du service Balise, par Mvth1s.`,
});
</script>

<template>
  <div class="container legal">
    <nav aria-label="Fil d’Ariane" class="small">
      <ol class="breadcrumb">
        <li><RouterLink to="/">Accueil</RouterLink></li>
        <li>
          <span aria-current="page">{{ title }}</span>
        </li>
      </ol>
    </nav>
    <h1>{{ title }}</h1>
    <p v-if="updated" class="muted small">
      Dernière mise à jour : <time :datetime="updated">{{ formatLongDate(updated) }}</time>
    </p>
    <div class="prose">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.legal {
  max-width: 48rem;
  padding-block: var(--space-12);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
</style>
