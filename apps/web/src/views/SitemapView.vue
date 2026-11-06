<script setup lang="ts">
import LegalPage from '@/components/LegalPage.vue';
import { STATIC_PAGES, type PageGroup } from '@/router/pages';

const GROUPS: { id: PageGroup; title: string }[] = [
  { id: 'outil', title: 'Outil' },
  { id: 'demo', title: 'Démonstration' },
  { id: 'legal', title: 'Informations légales et contact' },
];
const pagesOf = (group: PageGroup) =>
  STATIC_PAGES.filter((p) => p.group === group && p.inSitemapPage);
</script>

<template>
  <LegalPage title="Plan du site" description="Toutes les pages du site Balise.">
    <section v-for="g in GROUPS" :key="g.id" :aria-labelledby="`plan-${g.id}`">
      <h2 :id="`plan-${g.id}`">{{ g.title }}</h2>
      <ul>
        <li v-for="p in pagesOf(g.id)" :key="p.path">
          <RouterLink :to="p.path">{{ p.label }}</RouterLink>
        </li>
      </ul>
    </section>
  </LegalPage>
</template>
