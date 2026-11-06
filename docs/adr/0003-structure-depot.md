# ADR 0003 — Structure du dépôt

- Statut : acceptée
- Date : 2026-11-05
- Auteur : Mvth1s

## Contexte

Balise comprend un front Vue, une API serverless, un moteur d'analyse et un référentiel RGAA versionné. Le moteur et le référentiel doivent être testables seuls, sans navigateur de production ni plateforme Vercel. Le projet est maintenu par une seule personne : la structure doit rester simple.

Contrainte propre à Vercel : **chaque fichier placé dans `api/` devient une fonction déployée** (sauf les fichiers et dossiers préfixés par `_`). Y mettre de la logique, des utilitaires ou des tests créerait des fonctions inutiles, voire exposées.

## Décision

Monorepo pnpm (workspace) :

```
apps/web/               Front Vue 3 + Vite (paquet @balise/web)
packages/analyzer/      Moteur : filtre SSRF, navigateur, axe-core, contrôles maison, mapping, scores (@balise/analyzer)
packages/rgaa-mapping/  Référentiel RGAA versionné + types + chargeur (@balise/rgaa-mapping)
server/                 Logique de l'API : handlers Request → Response, stockage, limitation de débit, tests
api/                    Points d'entrée Vercel minces, qui délèguent à server/
e2e/                    Tests Playwright de bout en bout
scripts/                Outils (rapports de démo, API locale, serveur des tests e2e)
docs/                   Documentation
```

- **`server/` séparé de `api/`** : `api/` ne contient que des fichiers d'une poignée de lignes qui importent un handler de `server/`. Toute la logique (validation, stockage, limitation de débit, orchestration de l'analyse) vit dans `server/`, testée par Vitest sans Vercel. Le script `scripts/dev-api.ts` sert les mêmes handlers en local.
- **Paquets internes** : `@balise/analyzer` et `@balise/rgaa-mapping` sont des paquets du workspace. Ils exposent une condition d'export `source` : en développement et en test, on importe directement le TypeScript, sans étape de build.
- **Types partagés** : le contrat du rapport (`AnalysisStatus`, `AnalysisReport`) est défini une seule fois dans `packages/analyzer/src/types.ts` et importé en type seul par l'API et le front.
- **Configuration commune** à la racine : TypeScript (`tsconfig.base.json`), ESLint, Prettier, Vitest (projets), commitlint.

## Conséquences

Positives :

- Une seule installation, un seul lockfile, une seule CI.
- Le moteur et le référentiel sont testables et couverts (objectif 80 %) indépendamment de l'interface.
- Les handlers de `server/` utilisent l'API Web standard (`Request`/`Response`) : ils sont portables vers un autre hôte (voir le chemin de migration de l'[ADR 0001](0001-hebergement-vercel.md)).
- Surface déployée minimale : seules les routes voulues existent dans `api/`.

Négatives :

- Le bundle d'une fonction doit inclure les paquets du workspace et Chromium : la taille (250 Mo non compressés) est à surveiller.
- Les règles d'export (`source`, `import`, `types`) doivent rester cohérentes entre paquets.

## Alternatives étudiées

- **Application unique sans paquets** : plus simple au départ, mais le moteur serait mêlé au front et à l'API, plus difficile à tester et à réutiliser (scripts de démo, futur worker).
- **Logique directement dans `api/`** : écartée, car chaque fichier de `api/` devient une fonction ; les fichiers préfixés par `_` évitent le déploiement mais rendent l'arborescence confuse.
- **Turborepo ou Nx** : utiles pour de gros dépôts. Superflus ici : les scripts pnpm suffisent.
