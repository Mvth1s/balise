## Description

<!-- Ce qui change et pourquoi. Référencez le ticket concerné : « Closes #123 ». -->

## Type de changement

- [ ] Correction (`fix`)
- [ ] Fonctionnalité (`feat`)
- [ ] Documentation (`docs`)
- [ ] Maintenance, CI, refactorisation (`chore`, `ci`, `refactor`)
- [ ] Rupture de compatibilité (`!` ou `BREAKING CHANGE:`)

## Liste de contrôle

### Tests

- [ ] Les tests unitaires et d'intégration couvrent le changement (`pnpm test`).
- [ ] Les tests e2e passent (`pnpm build && pnpm test:e2e`).
- [ ] `pnpm lint`, `pnpm format:check` et `pnpm typecheck` passent.

### Accessibilité

- [ ] Aucune violation axe sur les pages et états touchés.
- [ ] Parcours complet au clavier, focus visible.
- [ ] Vérifié à 320 px de large, avec un zoom à 200 % et avec `prefers-reduced-motion`.
- [ ] La couleur ne porte jamais seule l'information.
- [ ] Aucun texte ne promet de conformité (« scores indicatifs » uniquement).

### Sécurité

- [ ] Aucun secret, jeton ni donnée personnelle dans le code, les tests ou les journaux.
- [ ] Le contenu issu des pages analysées est affiché échappé (pas de `v-html`).
- [ ] Toute modification du filtre SSRF est accompagnée de tests.
- [ ] Les nouvelles dépendances sont épinglées en version exacte et publiées depuis au moins 14 jours.

### Documentation et commits

- [ ] La documentation (`docs/`, README) est à jour.
- [ ] Les messages de commit suivent Conventional Commits, en anglais.
