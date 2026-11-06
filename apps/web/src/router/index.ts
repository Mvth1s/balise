import type { RouteRecordRaw, RouterScrollBehavior } from 'vue-router';
import HomeView from '@/views/HomeView.vue';
import { STATIC_PAGES } from './pages';

/** Component of every static page, by route name (see pages.ts). */
export const PAGE_COMPONENTS: Record<string, RouteRecordRaw['component']> = {
  home: HomeView,
  example: () => import('@/views/ExampleCompareView.vue'),
  'example-before': () => import('@/views/ExampleReportView.vue'),
  'example-after': () => import('@/views/ExampleReportView.vue'),
  'demo-before': () => import('@/views/DemoView.vue'),
  'demo-after': () => import('@/views/DemoView.vue'),
  'legal-notice': () => import('@/views/legal/MentionsLegalesView.vue'),
  privacy: () => import('@/views/legal/ConfidentialiteView.vue'),
  cookies: () => import('@/views/CookiesView.vue'),
  accessibility: () => import('@/views/legal/AccessibiliteView.vue'),
  terms: () => import('@/views/legal/ConditionsView.vue'),
  sitemap: () => import('@/views/SitemapView.vue'),
  contact: () => import('@/views/legal/ContactView.vue'),
};

const PAGE_PROPS: Record<string, Record<string, unknown>> = {
  'example-before': { variant: 'avant' },
  'example-after': { variant: 'apres' },
  'demo-before': { broken: true },
  'demo-after': { broken: false },
};

export const routes: RouteRecordRaw[] = [
  ...STATIC_PAGES.map(
    (p) =>
      ({
        path: p.path,
        name: p.name,
        component: PAGE_COMPONENTS[p.name],
        props: PAGE_PROPS[p.name] ?? false,
      }) as RouteRecordRaw,
  ),
  // Vercel rewrites /analyses/:id to the pre-rendered /analyses shell.
  { path: '/analyses/:id?', name: 'analysis', component: () => import('@/views/AnalysisView.vue') },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
  },
];

export const scrollBehavior: RouterScrollBehavior = (to, from, saved) => {
  if (saved) return saved;
  if (to.hash) return { el: to.hash };
  if (to.path === from.path) return false;
  return { top: 0 };
};
