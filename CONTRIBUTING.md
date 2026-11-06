# Contribuer à Balise

Merci de votre intérêt pour Balise. Ce guide explique comment installer le projet, proposer une modification et respecter les règles qui font de Balise un outil fiable et lui-même accessible.

En participant, vous acceptez de respecter le [code de conduite](CODE_OF_CONDUCT.md). Pour signaler une vulnérabilité, suivez la [politique de sécurité](SECURITY.md) : n'ouvrez pas de ticket public.

## Démarrage local

Prérequis :

- Node.js 24 (version indiquée dans `.nvmrc`) ;
- pnpm 12 (version exacte dans le champ `packageManager` de `package.json`, activable avec `corepack enable`).

```sh
pnpm install                              # installe toutes les dépendances du monorepo
pnpm exec playwright install chromium     # navigateur local pour l'analyse, les tests et la démo
cp .env.example .env.local                # facultatif : sans Upstash, l'API utilise un stockage en mémoire
pnpm dev                                  # front (Vite)
pnpm dev:api                              # API locale, dans un second terminal
```

## Commandes utiles

| Commande                 | Rôle                                                            |
| ------------------------ | --------------------------------------------------------------- |
| `pnpm lint`              | ESLint, zéro avertissement toléré                               |
| `pnpm format`            | Formate le code avec Prettier (`pnpm format:check` en CI)       |
| `pnpm typecheck`         | Vérification des types (TypeScript et `vue-tsc`)                |
| `pnpm test`              | Tests unitaires et d'intégration (Vitest)                       |
| `pnpm test:coverage`     | Idem avec couverture (80 % minimum sur le moteur et le mapping) |
| `pnpm build`             | Construit les paquets puis le front (`apps/web/dist`)           |
| `pnpm test:e2e`          | Tests de bout en bout Playwright avec axe (après `pnpm build`)  |
| `pnpm exec lhci autorun` | Lighthouse CI sur le build (après `pnpm build`)                 |
| `pnpm demo:build`        | Régénère les rapports de démonstration versionnés               |

Pour lancer les tests e2e contre une prévisualisation Vercel plutôt que contre le serveur local : `E2E_BASE_URL=https://… pnpm test:e2e`.

## Branches et pull requests

- Ne poussez jamais directement sur `main` : créez une branche (`feat/…`, `fix/…`, `docs/…`, `chore/…`) puis ouvrez une pull request.
- Une pull request = un sujet. Gardez-la petite et décrivez ce qui change et pourquoi.
- La fusion n'a lieu que lorsque la CI est verte (lint, format, types, tests, build, e2e, Lighthouse, CodeQL, revue des dépendances).
- L'historique de `main` est linéaire : fusion par _rebase_ ou _squash_, jamais de commit de fusion ni de `push --force` sur `main`.
- Remplissez la liste de contrôle du modèle de pull request.

## Conventions de commit

Les messages de commit sont rédigés **en anglais** au format [Conventional Commits](https://www.conventionalcommits.org/fr/v1.0.0/), vérifié par commitlint au moment du commit :

```
feat(analyzer): detect missing skip link
fix(web): keep focus on the URL field after an error
docs: explain the scoring formula
```

Types courants : `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `perf`, `build`. Un `!` après le type ou un pied `BREAKING CHANGE:` signale une rupture de compatibilité.

Les versions (tags) et les releases GitHub, dont les notes tiennent lieu de journal des modifications, sont produites automatiquement par semantic-release à partir de ces messages : `fix` donne une version corrective, `feat` une version mineure, une rupture une version majeure.

Le code, les identifiants et les commits sont en anglais ; les textes d'interface et la documentation sont en français, avec vouvoiement.

## Règles d'accessibilité

Balise doit être exemplaire. Toute modification de l'interface doit :

- ne provoquer **aucune violation axe** dans les tests e2e (la CI échoue sinon) ;
- rester entièrement utilisable au clavier, avec un focus toujours visible ;
- rester lisible et utilisable à 320 px de large et avec un zoom à 200 % ;
- respecter `prefers-reduced-motion` (aucun déplacement si la préférence est active) ;
- ne jamais transmettre une information par la couleur seule (toujours une icône ou un libellé) ;
- conserver des contrastes conformes aux jetons de la charte (`docs/charte/`).

Les textes ne promettent jamais de conformité : pas de « conforme RGAA », « certifié » ni « 100 % accessible ». On parle toujours de **scores indicatifs** et on affiche la couverture.

## Règles de sécurité

- Aucun secret dans le dépôt, les tests ou les journaux. Les variables sont décrites dans `.env.example` et `docs/exploitation.md`.
- Tout contenu issu des pages analysées est affiché échappé : `v-html` est interdit (règle ESLint active).
- Toute modification du filtre SSRF (`packages/analyzer`) s'accompagne de tests sur les cas limites (IPv4, IPv6, redirections, DNS rebinding). Voir `docs/securite.md`.
- Les dépendances sont épinglées en version exacte et ne doivent pas avoir été publiées depuis moins de 14 jours (vérifiez avec `npm view <paquet> time`).
- Aucun appel à un service tiers avant consentement de l'utilisateur.

## Ajouter ou modifier une règle RGAA

La correspondance entre les règles de test et les critères RGAA 4.1.2 est décrite dans `docs/rgaa-mapping.md`. En résumé :

1. Vérifiez le numéro, l'intitulé et la thématique du critère dans le référentiel officiel publié par la DINUM ; n'inventez rien.
2. Ajoutez ou modifiez l'entrée dans `packages/rgaa-mapping/src/data/rgaa-4.1.2.json` en citant sa source.
3. Si la règle est un contrôle maison, implémentez-le dans `packages/analyzer` avec ses tests unitaires.
4. Lancez `pnpm test` (chaque règle doit pointer vers un critère existant) puis `pnpm demo:build` si les rapports de démonstration changent.
5. Mettez à jour `docs/rgaa-mapping.md` si la couverture évolue.

## Signaler un problème

Utilisez les [modèles de ticket](https://github.com/Mvth1s/balise/issues/new/choose) : bogue, amélioration ou problème d'accessibilité de Balise. Pour une vulnérabilité, consultez [SECURITY.md](SECURITY.md).
