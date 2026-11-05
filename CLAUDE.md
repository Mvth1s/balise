# Balise — guide pour les sessions Claude Code

Balise est un outil web de **pré-diagnostic d'accessibilité RGAA 4.1.2** : l'utilisateur saisit l'URL d'une page publique, Balise la charge dans un Chromium headless, exécute axe-core et des contrôles maison, mappe les résultats sur les critères RGAA et affiche des **scores indicatifs** par thématique et un score global, avec erreurs, pistes de correction et critères à vérifier manuellement.

Spécification de référence : `docs/specs/kickoff.md`. Charte : `docs/charte/`. Maquettes : `docs/maquette/`.

## Règles non négociables

1. **Pseudo uniquement** : l'éditeur est `Mvth1s`, partout. Jamais de nom réel. Contact projet : `mag.d3v+balise@pm.me`.
2. **Accessibilité** : Balise doit être exemplaire (objectif 100 % des critères RGAA applicables). Zéro violation axe en e2e sur chaque page et état (hors contenu volontairement fautif de `/demo/avant`). Clavier, focus visible, zoom 200 %, 320 px, `prefers-reduced-motion`. La couleur ne porte jamais seule l'information.
3. **Honnêteté** : jamais de promesse de conformité (« conforme RGAA », « certifié », « 100 % accessible » interdits). Toujours « scores indicatifs » + couverture affichée.
4. **Sécurité** : filtre SSRF strict (voir `docs/securite.md`), aucun secret dans le dépôt, tout contenu issu des pages analysées est affiché échappé (interdiction de `v-html`, règle ESLint active).
5. **Vie privée** : polices auto-hébergées, aucun appel tiers avant consentement, GA4 seulement si `VITE_GA_MEASUREMENT_ID` est défini et après consentement.
6. **Versions** : dépendances épinglées en version exacte, jamais publiées depuis moins de 14 jours (`minimumReleaseAge` dans `pnpm-workspace.yaml`). Vérifier avec `npm view <paquet> time`.
7. **Git** : commits en anglais, Conventional Commits (commitlint). Branches + PR, fusion quand la CI est verte, historique linéaire. Jamais de `--force`.

## Stack

- TypeScript strict (TS 6.0.x : typescript-eslint ne prend pas encore TS 7), ESM, Node 24.x, pnpm 12 (workspace).
- Front `apps/web` : Vue 3 + Vite 8 + vue-router 5 + vite-ssg (pré-rendu accueil, pages légales, démo).
- API `api/` : Vercel Functions (runtime Node.js, région `cdg1`, `maxDuration` 300 s). Points d'entrée minces ; la logique est dans `server/` (testable sans Vercel).
- Moteur `packages/analyzer` : playwright-core 1.63.0 + @sparticuz/chromium 153 (même version majeure de Chromium) + @axe-core/playwright.
- Référentiel `packages/rgaa-mapping` : `src/data/rgaa-4.1.2.json` (critères officiels + règles → critères).
- Stockage : Upstash Redis (marketplace Vercel), TTL 30 jours, derrière l'interface `AnalysisStore` ; repli en mémoire en local. Limitation de débit `@upstash/ratelimit` (10/h par IP hachée).
- Tests : Vitest (projets `packages/*`, `apps/web`, `server`), Playwright Test (`e2e/`) avec axe.

## Arborescence

```
api/                    Vercel Functions (fichiers minces ; `_`-préfixés = non déployés)
server/                 Logique API : handlers Request→Response, stockage, rate limit, tests
packages/analyzer/      Moteur : url-guard (SSRF), safe-fetch, browser, checks maison, mapping, scoring
packages/rgaa-mapping/  Référentiel RGAA versionné + types + loader
apps/web/               Front Vue
e2e/                    Tests Playwright de bout en bout
scripts/                demo-build.ts (rapports pré-calculés), dev-api.ts (API locale)
docs/                   Architecture, ADR, API, scoring, sécurité, exploitation, accessibilité, journal
```

## API (contrat)

- `POST /api/analyses` `{ url }` → `202 { id, url, state }` ; erreurs `400 invalid_url`, `422 forbidden_target`, `429 rate_limited`.
- `GET /api/analyses/:id` → `200 AnalysisStatus` (voir `packages/analyzer/src/types.ts`) ou `404 not_found`.
- `DELETE /api/analyses/:id` → `202` (annulation).
- `GET /api/analyses/:id/screenshot` → `image/jpeg`.
- Erreurs : `{ "error": { "code", "message" } }`, message en français.

## Commandes

```
pnpm install              # installe tout
pnpm dev                  # front (Vite) ; l'API locale : pnpm dev:api
pnpm build                # paquets puis front
pnpm lint | typecheck | test | test:coverage | test:e2e
pnpm demo:build           # régénère les rapports de démo versionnés
pnpm exec playwright install chromium   # navigateur local pour tests/démo
```

## Conventions

- Code et commits en anglais ; textes d'interface, docs et pages légales en français, vouvoiement.
- Imports entre paquets via la condition d'export `source` (pas de build nécessaire en dev/test).
- Couverture ≥ 80 % sur `packages/analyzer` et `packages/rgaa-mapping`.
- Après chaque étape : CI verte, commit, point dans `docs/journal.md`.
- Agents du projet : `.claude/agents/` (frontend-dev, backend-dev, rgaa-mapper, a11y-auditor, security-reviewer, test-engineer, devops, docs-writer).
