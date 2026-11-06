import { useHead } from '@unhead/vue';
import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useRoute } from 'vue-router';

export const SITE_NAME = 'Balise';

export interface PageMetaOptions {
  /** Page title without the site name ("Mentions légales"). */
  title: MaybeRefOrGetter<string>;
  description: MaybeRefOrGetter<string>;
  /** Use the title as is (no " – Balise" suffix). */
  rawTitle?: boolean;
  noindex?: boolean;
  /** Canonical path; defaults to the current route path. false: no canonical. */
  canonicalPath?: string | false;
}

export function pageTitle(title: string): string {
  return `${title} – ${SITE_NAME}`;
}

function siteUrl(): string {
  return (import.meta.env.VITE_SITE_URL ?? '').replace(/\/+$/, '');
}

/** Unique title "Page – Balise", meta description, canonical, robots. */
export function usePageMeta(options: PageMetaOptions): void {
  const route = useRoute();
  const title = computed(() =>
    options.rawTitle ? toValue(options.title) : pageTitle(toValue(options.title)),
  );
  const description = computed(() => toValue(options.description));
  const canonical = computed(() => {
    const base = siteUrl();
    if (!base || options.canonicalPath === false || options.noindex) return null;
    const path = options.canonicalPath ?? route.path;
    return base + (path === '/' ? '/' : path.replace(/\/+$/, ''));
  });

  useHead({
    title,
    meta: computed(() => [
      { name: 'description', content: description.value },
      { property: 'og:title', content: title.value },
      { property: 'og:description', content: description.value },
      ...(options.noindex ? [{ name: 'robots', content: 'noindex, nofollow' }] : []),
    ]),
    link: computed(() => (canonical.value ? [{ rel: 'canonical', href: canonical.value }] : [])),
  });
}
