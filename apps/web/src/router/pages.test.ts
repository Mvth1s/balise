import { describe, expect, it } from 'vitest';
import { PAGE_COMPONENTS, routes } from './index';
import { buildSitemapXml, prerenderedPaths, STATIC_PAGES } from './pages';

describe('pages', () => {
  it('has a component for every static page', () => {
    for (const p of STATIC_PAGES) expect(PAGE_COMPONENTS[p.name], p.name).toBeTruthy();
    expect(routes.some((r) => r.path === '/analyses/:id?')).toBe(true);
  });

  it('pre-renders the static pages, the analysis shell and the 404 page', () => {
    expect(prerenderedPaths()).toEqual(
      expect.arrayContaining(['/', '/demo/avant', '/analyses', '/404']),
    );
  });

  it('keeps /demo/avant out of sitemap.xml', () => {
    const xml = buildSitemapXml('https://balise.example/', '2026-11-05');
    expect(xml).toContain('<loc>https://balise.example/</loc>');
    expect(xml).toContain('<loc>https://balise.example/demo/apres</loc>');
    expect(xml).not.toContain('/demo/avant');
  });
});
