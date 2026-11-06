<script setup lang="ts">
import { usePageMeta } from '@/composables/usePageMeta';

usePageMeta({
  title: 'Page introuvable',
  description: 'Cette page n’existe pas sur Balise.',
  noindex: true,
});
</script>

<template>
  <div class="container not-found">
    <h1>Page introuvable</h1>
    <p>L’adresse demandée ne correspond à aucune page de Balise. Elle a peut-être été déplacée.</p>
    <ul>
      <li><RouterLink to="/">Analyser une page depuis l’accueil</RouterLink></li>
      <li><RouterLink to="/plan-du-site">Consulter le plan du site</RouterLink></li>
    </ul>
  </div>
</template>

<style scoped>
.not-found {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding-block: var(--space-12);
}
</style>
