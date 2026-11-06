/**
 * Static pages of the site: single source of truth for the router meta,
 * the pre-rendered routes (vite-ssg), sitemap.xml and the "Plan du site" page.
 * Pure data, no Vue import: also loaded by vite.config.ts.
 */

export type PageGroup = 'outil' | 'demo' | 'legal';

export interface StaticPage {
  path: string;
  name: string;
  /** Label used in the "Plan du site" page. */
  label: string;
  group: PageGroup;
  /** Listed in sitemap.xml and indexable by search engines. */
  indexable: boolean;
  /** Listed in the "Plan du site" page. */
  inSitemapPage: boolean;
}

export const STATIC_PAGES: readonly StaticPage[] = [
  {
    path: '/',
    name: 'home',
    label: 'Accueil',
    group: 'outil',
    indexable: true,
    inSitemapPage: true,
  },
  {
    path: '/exemple',
    name: 'example',
    label: 'Exemple : avant et après correction',
    group: 'demo',
    indexable: true,
    inSitemapPage: true,
  },
  {
    path: '/exemple/avant',
    name: 'example-before',
    label: 'Rapport d’exemple : page avant correction',
    group: 'demo',
    indexable: true,
    inSitemapPage: true,
  },
  {
    path: '/exemple/apres',
    name: 'example-after',
    label: 'Rapport d’exemple : page après correction',
    group: 'demo',
    indexable: true,
    inSitemapPage: true,
  },
  {
    path: '/demo/avant',
    name: 'demo-before',
    label: 'Page de démonstration avec erreurs volontaires',
    group: 'demo',
    indexable: false,
    inSitemapPage: true,
  },
  {
    path: '/demo/apres',
    name: 'demo-after',
    label: 'Page de démonstration corrigée',
    group: 'demo',
    indexable: true,
    inSitemapPage: true,
  },
  {
    path: '/mentions-legales',
    name: 'legal-notice',
    label: 'Mentions légales',
    group: 'legal',
    indexable: true,
    inSitemapPage: true,
  },
  {
    path: '/confidentialite',
    name: 'privacy',
    label: 'Politique de confidentialité',
    group: 'legal',
    indexable: true,
    inSitemapPage: true,
  },
  {
    path: '/cookies',
    name: 'cookies',
    label: 'Gestion des cookies',
    group: 'legal',
    indexable: true,
    inSitemapPage: true,
  },
  {
    path: '/accessibilite',
    name: 'accessibility',
    label: 'Déclaration d’accessibilité',
    group: 'legal',
    indexable: true,
    inSitemapPage: true,
  },
  {
    path: '/conditions-utilisation',
    name: 'terms',
    label: 'Conditions d’utilisation',
    group: 'legal',
    indexable: true,
    inSitemapPage: true,
  },
  {
    path: '/plan-du-site',
    name: 'sitemap',
    label: 'Plan du site',
    group: 'legal',
    indexable: true,
    inSitemapPage: true,
  },
  {
    path: '/contact',
    name: 'contact',
    label: 'Contact',
    group: 'legal',
    indexable: true,
    inSitemapPage: true,
  },
];

/**
 * Shell of the analysis page. Vercel rewrites /analyses/:id to it; the
 * id-dependent content is rendered client-side after mount.
 */
export const ANALYSIS_SHELL_PATH = '/analyses';

/** Pre-rendered as 404.html (served by Vercel for unknown paths). */
export const NOT_FOUND_PATH = '/404';

/** Every path pre-rendered by vite-ssg. */
export function prerenderedPaths(): string[] {
  return [...STATIC_PAGES.map((p) => p.path), ANALYSIS_SHELL_PATH, NOT_FOUND_PATH];
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** sitemap.xml for the indexable static pages (siteUrl without trailing slash). */
export function buildSitemapXml(siteUrl: string, lastmod: string): string {
  const base = siteUrl.replace(/\/+$/, '');
  const urls = STATIC_PAGES.filter((p) => p.indexable)
    .map(
      (p) =>
        `  <url><loc>${escapeXml(base + (p.path === '/' ? '/' : p.path))}</loc><lastmod>${lastmod}</lastmod></url>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
