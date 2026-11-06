import { appendFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { transformHtmlTemplate } from '@unhead/vue/server';
import { defaultClientConditions, defaultServerConditions, defineConfig, loadEnv } from 'vite';
import { buildSitemapXml, prerenderedPaths } from './src/router/pages.ts';

const envDir = fileURLToPath(new URL('../..', import.meta.url));
const outDir = fileURLToPath(new URL('./dist', import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, 'VITE_');
  const siteUrl = (env.VITE_SITE_URL ?? '').replace(/\/+$/, '');

  return {
    // The monorepo keeps a single .env.example / .env.local at its root.
    envDir,
    plugins: [
      // <blink> is an intentional error of /demo/avant (RGAA 13.8): native, not a component.
      vue({ template: { compilerOptions: { isCustomElement: (tag) => tag === 'blink' } } }),
    ],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
      // Workspace packages are consumed from their TypeScript sources.
      conditions: ['source', ...defaultClientConditions],
    },
    ssr: {
      resolve: { conditions: ['source', ...defaultServerConditions] },
    },
    server: {
      proxy: { '/api': { target: 'http://127.0.0.1:3000', changeOrigin: true } },
    },
    build: {
      // No inline assets: the CSP forbids data: fonts/scripts and inline styles.
      assetsInlineLimit: 0,
    },
    ssgOptions: {
      formatting: 'none',
      // flat: /mentions-legales -> mentions-legales.html, served at the clean
      // URL by Vercel `cleanUrls: true`. See README.md.
      dirStyle: 'flat',
      // Critical CSS inlining would add <style> tags, forbidden by the CSP.
      beastiesOptions: false,
      includedRoutes: () => prerenderedPaths(),
      // vite-ssg bundles its own @unhead/vue 2; Balise uses @unhead/vue 3,
      // stored on the context by src/main.ts and rendered here.
      onPageRendered: (_route, html, appCtx) => {
        const head = (appCtx as unknown as { unhead?: Parameters<typeof transformHtmlTemplate>[0] })
          .unhead;
        return head ? transformHtmlTemplate(head, html) : html;
      },
      onFinished: () => {
        if (!siteUrl) {
          console.warn('[balise] VITE_SITE_URL is not set: sitemap.xml was not generated.');
          return;
        }
        const lastmod = new Date().toISOString().slice(0, 10);
        writeFileSync(`${outDir}/sitemap.xml`, buildSitemapXml(siteUrl, lastmod), 'utf8');
        const robots = `${outDir}/robots.txt`;
        // robots.txt always ships from public/.
        appendFileSync(robots, `\nSitemap: ${siteUrl}/sitemap.xml\n`);
      },
    },
  };
});
