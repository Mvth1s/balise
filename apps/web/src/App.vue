<script setup lang="ts">
import { useHead } from '@unhead/vue';
import { nextTick, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import ConsentBanner from '@/components/ConsentBanner.vue';
import SiteFooter from '@/components/SiteFooter.vue';
import SiteHeader from '@/components/SiteHeader.vue';
import { initConsent, pageView } from '@/composables/useConsent';
import { initPreferences } from '@/composables/usePreferences';
import { markHydrated } from '@/lib/hydration';
import { focusMainHeading } from '@/lib/focus';

const router = useRouter();
// unhead would otherwise render lang="en" over index.html.
useHead({ htmlAttrs: { lang: 'fr' } });

onMounted(() => {
  markHydrated();
  initPreferences();
  initConsent();
  // Client-side navigation: move focus to the new page heading (RGAA 12.x).
  router.afterEach((to, from, failure) => {
    if (failure || to.path === from.path) return;
    void nextTick(() => {
      if (!to.hash) focusMainHeading();
      // unhead updates document.title asynchronously.
      window.setTimeout(() => pageView(to.path), 100);
    });
  });
});
</script>

<template>
  <a class="skip-link" href="#contenu">Aller au contenu</a>
  <ConsentBanner />
  <SiteHeader />
  <main id="contenu" class="site-main" tabindex="-1">
    <RouterView />
  </main>
  <SiteFooter />
</template>

<style scoped>
.skip-link {
  position: absolute;
  left: var(--space-4);
  top: var(--space-2);
  z-index: 10;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-brand);
  color: var(--color-on-brand);
  font-weight: 700;
  transform: translateY(-200%);
}

.skip-link:focus {
  transform: none;
}

.site-main {
  flex: 1;
}

.site-main:focus {
  outline: none;
}
</style>
