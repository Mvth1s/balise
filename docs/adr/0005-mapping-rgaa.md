# ADR 0005 — Correspondance règles de test → critères RGAA

- Statut : acceptée
- Date : 2026-11-05
- Auteur : Mvth1s

## Contexte

Balise exécute axe-core et des contrôles maison. Ces outils produisent des résultats par **règle** (par exemple `image-alt`), alors que l'utilisateur attend des résultats par **critère RGAA** (par exemple 1.1) et par thématique.

Exigences :

- numéros, intitulés et thématiques **exacts**, issus du référentiel officiel publié par la DINUM ; aucune invention ;
- chaque correspondance doit être justifiée et sourcée ;
- une règle peut couvrir plusieurs critères, et un critère peut dépendre de plusieurs règles ;
- certaines règles ne savent que **détecter des erreurs** : leur réussite ne prouve pas la conformité ;
- le RGAA évoluera (RGAA 5 annoncé) : la structure doit accueillir une nouvelle version sans réécrire le moteur.

## Décision

- **Fichier JSON versionné** par version du référentiel : `packages/rgaa-mapping/src/data/rgaa-4.1.2.json`. Il contient :
  - `themes` : les 13 thématiques (numéro, intitulé officiel) ;
  - `criteria` : tous les critères (identifiant, thématique, intitulé verbatim, lien vers le critère officiel, critères WCAG associés si le référentiel les fournit) ;
  - `rules` : les correspondances règle → critères ;
  - `sources` : les sources officielles consultées (URL et date, ou commit du dépôt officiel).
- **Types TypeScript** (`packages/rgaa-mapping/src/types.ts`) qui décrivent ce format pour toutes les versions.
- **Sources officielles uniquement** : site https://accessibilite.numerique.gouv.fr et dépôt officiel du référentiel s'il existe. Chaque entrée de `rules` porte un champ `source` (URL + date de consultation ou commit).
- **Couverture d'une règle** (`coverage`) :
  - `full` : si la règle s'applique à des éléments, réussit partout et ne laisse aucun résultat incomplet, le critère peut être déclaré « Conforme (auto) » ;
  - `partial` : la règle ne sait que détecter des échecs ; une réussite laisse le critère « À vérifier manuellement ».
- **Textes pour l'utilisateur** dans le mapping : `rationale` (pourquoi la règle concerne ce critère), `explanation` (le problème, en français clair), `fix` (piste de correction).
- **Registre des versions** dans `packages/rgaa-mapping/src/index.ts` : `getReference(version)`, version par défaut `4.1.2`. Pour le RGAA 5, ajouter `rgaa-5.json` au même format et l'enregistrer dans ce registre.
- **Tests** : chaque règle mappée doit pointer vers un critère existant du référentiel ; chaque critère doit appartenir à une thématique existante.

Le fichier est construit et maintenu par l'agent `rgaa-mapper`. La méthode détaillée est décrite dans `docs/rgaa-mapping.md`.

## Conséquences

Positives :

- Les résultats sont traçables : pour chaque critère affiché, on sait quelle règle a joué et pourquoi.
- Distinction honnête entre « aucune erreur détectée » et « conforme ».
- Passage au RGAA 5 sans toucher au moteur : nouveau fichier, même format.
- Les rapports enregistrent la version du référentiel utilisée (`reference.version`).

Négatives :

- Mise à jour manuelle à chaque nouvelle version d'axe-core (règles ajoutées, renommées ou supprimées).
- Une correspondance règle → critère reste une interprétation : elle est documentée, mais peut être discutée. Toute correction passe par une PR qui cite sa source.

## Alternatives étudiées

- **Utiliser les étiquettes WCAG d'axe-core et passer par la correspondance WCAG → RGAA** : automatique, mais imprécis. Le RGAA n'est pas une simple traduction des WCAG, et une étiquette WCAG ne dit pas si la règle prouve la conformité ou seulement l'échec.
- **Correspondance codée en dur dans le moteur** : moins lisible, impossible à relire sans lire le code, et difficile à versionner par référentiel.
- **Base de données** : inutile pour un fichier statique de quelques centaines d'entrées ; le JSON versionné dans Git offre l'historique et la revue par PR.
