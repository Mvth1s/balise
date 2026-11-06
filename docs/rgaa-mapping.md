# Correspondance RGAA

Ce document explique comment Balise relie les règles de test (axe-core et contrôles maison) aux critères du RGAA 4.1.2, et comment faire évoluer ce référentiel.

Le paquet concerné est `packages/rgaa-mapping` :

| Fichier                          | Rôle                                                               |
| -------------------------------- | ------------------------------------------------------------------ |
| `src/data/rgaa-4.1.2.json`       | Référentiel généré : sources, 13 thématiques, 106 critères, règles |
| `src/types.ts`                   | Format `RgaaReference`, commun à toutes les versions du RGAA       |
| `src/index.ts`                   | Chargement des versions (`REFERENCES`) et fonctions de recherche   |
| `scripts/rules-4.1.2.ts`         | Source éditable des correspondances règle → critères               |
| `scripts/generate-rgaa-4.1.2.ts` | Générateur du fichier JSON                                         |
| `src/index.test.ts`              | Tests de cohérence du référentiel et de l’API                      |

## Méthode

1. **Critères officiels.** Les thématiques, numéros, intitulés et références WCAG viennent uniquement du fichier officiel des critères publié par la DINUM. Le générateur le lit comme de simples données JSON : il retire les liens vers le glossaire (le texte du lien est conservé), normalise les espaces et ne modifie rien d’autre. Aucun intitulé n’est réécrit.
2. **Contrôle croisé.** Les 106 intitulés générés ont été comparés à ceux de la page officielle « Critères et tests » : aucune différence (après normalisation des espaces).
3. **Liens vers les critères.** Chaque critère pointe vers son ancre sur la page officielle, au format `#thématique.critère`, par exemple <https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/#1.1>. Ce format est celui des identifiants de la page publiée et du générateur du site officiel.
4. **Correspondances.** Chaque règle est rapprochée d’un ou plusieurs critères en lisant les tests officiels du critère. Deux indices aident sans décider à notre place : les références WCAG des critères officiels, et les étiquettes `RGAA-x.y.z` qu’axe-core 4.14.0 attache à ses règles. Quand l’indice d’axe-core ne correspond pas à la lecture du test officiel, la correspondance s’en écarte et le champ `rationale` le dit.

## Sources

| Source                                                                                                                                                                                                          | Version consultée                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Dépôt officiel DISIC/accessibilite.numerique.gouv.fr, fichier [`RGAA/criteres.json`](https://github.com/DISIC/accessibilite.numerique.gouv.fr/blob/ca4019f95073b6cbd2482a16e9f12b52d8de678d/RGAA/criteres.json) | commit `ca4019f95073b6cbd2482a16e9f12b52d8de678d`, récupéré le 5 novembre 2026 |
| Page officielle [Critères et tests](https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/) (RGAA 4.1.2)                                                                                            | consultée le 5 novembre 2026                                                   |
| Glossaire officiel `RGAA/glossaire.json` (même commit), pour les notions d’intitulé de lien, de langue par défaut et de titre de page                                                                           | commit `ca4019f…`                                                              |
| axe-core 4.14.0 (`axe.getRules()`) et fiches <https://dequeuniversity.com/rules/axe/4.14/>                                                                                                                      | consultées le 5 novembre 2026                                                  |

Remarque : le dépôt officiel contient aussi `RGAA/4.1/criteres.json`, conservé « pour mémoire » pour l’ancienne version 4.1. Le fichier utilisé est celui à la racine, `RGAA/criteres.json`, qui correspond au RGAA 4.1.2 publié sur le site.

Chaque correspondance porte sa propre source dans le champ `source` : la fiche de la règle axe-core, ou l’ancre du critère officiel pour un contrôle maison.

## Règles de décision

Chaque correspondance a une couverture :

- **`full`** : si la règle passe sur tous ses éléments applicables, sans résultat « incomplet », le critère peut être déclaré « Conforme (auto) ». Ce niveau est réservé aux cas où la règle vérifie tout ce que demande le critère.
- **`partial`** : la règle ne sait que détecter des erreurs. Un échec rend le critère « Non conforme (auto) » ; un succès le laisse « À vérifier manuellement ».

Principes appliqués :

- **Dans le doute, `partial`.** Dès qu’un test du critère demande un jugement humain (pertinence, caractère informatif d’une image, visibilité), ou que la règle ne couvre qu’une partie des éléments visés par le critère, la couverture est partielle.
- **Dans le doute sur le critère lui-même, pas de correspondance.** Mieux vaut un critère « À vérifier manuellement » qu’une erreur rangée au mauvais endroit.
- **`full` ne vise qu’un seul critère.** Le type ne permet qu’une couverture par règle : une règle reliée à plusieurs critères est donc toujours `partial` (un test l’impose).

Couverture `full` retenue pour la version actuelle :

| Règle               | Critère | Justification                                                                                    |
| ------------------- | ------- | ------------------------------------------------------------------------------------------------ |
| `html-has-lang`     | 8.3     | Le test 8.3.1 demande la présence de la langue par défaut ; la règle vérifie `lang` sur `<html>` |
| `document-title`    | 8.5     | Le test 8.5.1 demande une balise `<title>` ; la règle vérifie sa présence et son contenu         |
| `balise-page-title` | 8.5     | Même vérification, faite par le contrôle maison                                                  |
| `link-name`         | 6.2     | Le test 6.2.1 demande un intitulé ; la règle calcule le nom accessible comme le glossaire RGAA   |

Exemples de choix `partial` :

- `image-alt` (1.1) : une image avec `alt=""` passe la règle, mais elle peut être porteuse d’information.
- `color-contrast` (3.2) : le critère inclut le texte en image, que la règle ne mesure pas.
- `frame-title` (2.1) : le test 2.1.1 exige un attribut `title`, alors que la règle accepte aussi `aria-label`.
- `label` (11.1) : la règle accepte `placeholder` et ne vérifie pas la visibilité demandée par le test 11.1.3.

Règles volontairement non reliées : les règles AAA ou WCAG 2.2 absentes du RGAA 4.1.2 (`color-contrast-enhanced`, `identical-links-same-purpose`, `meta-refresh-no-exceptions`, `target-size`), les règles obsolètes (`duplicate-id`, `duplicate-id-active`, `audio-caption`, `aria-roledescription`), les règles expérimentales (`css-orientation-lock`, `p-as-heading`, `td-has-header`, `table-fake-caption`, `focus-order-semantics`, `hidden-content`), les bonnes pratiques sans critère clair (`region`, `landmark-*`, `tabindex`, `accesskeys`, …), les doublons des contrôles maison (`heading-order`, `page-has-heading-one`), et `label-content-name-mismatch`, qui concerne à la fois les liens (6.1), les boutons (11.9) et les champs (11.2) sans qu’on puisse savoir lequel à partir de l’identifiant de règle.

### Contrôles maison Balise

Leurs identifiants sont figés, le moteur (`packages/analyzer`) les implémente :

| Identifiant                | Critères | Couverture | Remarque                                                                                          |
| -------------------------- | -------- | ---------- | ------------------------------------------------------------------------------------------------- |
| `balise-skip-link`         | 12.7     | `partial`  | La place, l’ordre et la visibilité au focus dans l’ensemble des pages (12.7.2) restent à vérifier |
| `balise-heading-hierarchy` | 9.1      | `partial`  | La pertinence des titres (9.1.2) et les passages non balisés (9.1.3) restent à vérifier           |
| `balise-page-lang`         | 8.3, 8.4 | `partial`  | Échoue si la langue est absente (8.3) ou invalide (8.4) ; la pertinence du code reste à vérifier  |
| `balise-page-title`        | 8.5      | `full`     | La pertinence du titre (8.6) reste à vérifier manuellement, d’où l’absence de lien vers 8.6       |

## Ajouter ou modifier une règle

1. Vérifiez que la règle existe dans la version d’axe-core installée (`axe.getRules()`), ou que le contrôle maison est implémenté dans `packages/analyzer`.
2. Lisez les tests officiels du critère visé sur la page « Critères et tests ».
3. Ajoutez une entrée dans `packages/rgaa-mapping/scripts/rules-4.1.2.ts` avec `axe(…)` ou `balise(…)` :
   - `criteria` : les numéros de critères, par exemple `['1.1']` ;
   - `coverage` : `partial` par défaut, `full` seulement si les règles de décision ci-dessus le permettent ;
   - `rationale` : le test officiel concerné et la raison du choix de couverture ;
   - `explanation` : le problème, en une phrase courte, au vouvoiement (« Cette image n’a pas d’alternative textuelle : un lecteur d’écran ne peut pas la décrire. ») ;
   - `fix` : une piste de correction concrète.
4. Régénérez le JSON depuis la racine du dépôt, avec le fichier officiel téléchargé au commit noté dans les sources :

   ```sh
   SHA=ca4019f95073b6cbd2482a16e9f12b52d8de678d
   mkdir -p /tmp/rgaa-src
   curl -sfL -o /tmp/rgaa-src/criteres.json \
     "https://raw.githubusercontent.com/DISIC/accessibilite.numerique.gouv.fr/$SHA/RGAA/criteres.json"
   node --experimental-strip-types packages/rgaa-mapping/scripts/generate-rgaa-4.1.2.ts \
     --criteria /tmp/rgaa-src/criteres.json --sha "$SHA" --retrieved "$(date +%F)"
   pnpm exec prettier --write packages/rgaa-mapping/src/data/rgaa-4.1.2.json
   ```

   Le générateur refuse un fichier qui n’a pas 13 thématiques et 106 critères, une règle en double, ou une règle qui pointe vers un critère inexistant.

5. Lancez les tests : `pnpm vitest run --project rgaa-mapping`. Ils vérifient notamment que chaque règle axe-core reliée existe dans axe-core 4.14.0.

Lors d’une mise à jour d’axe-core, changez la version dans `packages/rgaa-mapping/package.json` et dans `AXE_VERSION` (`scripts/rules-4.1.2.ts`), mettez à jour l’URL des fiches Deque, puis relancez les tests : une règle supprimée ou renommée les fait échouer.

## Préparer le RGAA 5

Le format `RgaaReference` est indépendant de la version : un nouveau référentiel s’ajoute sans changer le code des consommateurs.

1. Repérez le fichier officiel des critères du RGAA 5 dans le dépôt DISIC et notez le SHA du commit.
2. Copiez `scripts/generate-rgaa-4.1.2.ts` et `scripts/rules-4.1.2.ts` en `generate-rgaa-5.ts` et `rules-5.ts`. Adaptez la version, le chemin de sortie (`src/data/rgaa-5.json`), le nombre attendu de thématiques et de critères, le format d’ancre s’il change sur le site officiel, et le format du fichier source s’il a évolué.
3. Reprenez chaque correspondance en relisant les nouveaux tests : les numéros de critères changeront probablement. Ne recopiez pas une correspondance 4.1.2 sans l’avoir revérifiée.
4. Déclarez la version dans `packages/rgaa-mapping/src/index.ts` :

   ```ts
   import rgaa5 from './data/rgaa-5.json' with { type: 'json' };

   const REFERENCES: Record<string, RgaaReference> = {
     '4.1.2': rgaa412 as RgaaReference,
     '5': rgaa5 as RgaaReference,
   };
   ```

   Changez `DEFAULT_REFERENCE_VERSION` seulement quand le moteur et l’interface sont prêts à basculer.

5. Ajoutez un fichier de tests pour la nouvelle version (nombre de thématiques et de critères, règles existantes dans axe-core, contrôles maison présents).
