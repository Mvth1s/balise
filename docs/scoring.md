# Calcul des scores

Ce document explique, en langage clair, comment Balise calcule ses scores et ce qu'ils ne disent pas.

> **Scores indicatifs.** Ils ne constituent pas un taux de conformité RGAA et ne doivent pas être repris dans une déclaration d'accessibilité.

## 1. Le point de départ : un statut par critère

Le RGAA 4.1.2 compte 106 critères, répartis en 13 thématiques. Pour chaque critère, Balise attribue l'un de ces statuts à partir des tests automatiques (axe-core et contrôles maison) et de la correspondance décrite dans [l'ADR 0005](adr/0005-mapping-rgaa.md) :

| Statut                      | Signification                                                                                                                                                        |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Conforme (auto)**         | Les règles qui couvrent entièrement ce critère se sont appliquées et n'ont trouvé aucune erreur.                                                                     |
| **Non conforme (auto)**     | Au moins une règle a détecté une erreur.                                                                                                                             |
| **À vérifier manuellement** | Aucun test automatique ne peut trancher, ou les règles ne savent que détecter des erreurs et n'en ont pas trouvé.                                                    |
| **Non applicable**          | Les règles du critère n'ont trouvé aucun élément concerné, et au moins l'une d'elles couvre entièrement le critère. Sinon, le critère reste à vérifier manuellement. |

Seuls les critères **Conforme (auto)** et **Non conforme (auto)** sont dits « testés » et entrent dans les scores. Les critères à vérifier manuellement et non applicables n'y entrent pas.

## 2. Score d'une thématique

```
score = 100 × C / (C + NC)
```

- `C` : nombre de critères de la thématique Conformes (auto) ;
- `NC` : nombre de critères de la thématique Non conformes (auto) ;
- `C + NC` : nombre de critères testés.

Le score est arrondi à l'entier.

Exemple : dans la thématique Images, 3 critères sont conformes et 1 non conforme. Score = 100 × 3 / 4 = **75**.

### « Non évaluable »

Si aucun critère de la thématique n'a été testé (`C + NC = 0`), la thématique est **Non évaluable**. Elle n'affiche jamais 100 : l'absence de test n'est pas une absence d'erreur.

## 3. Score global

Le score global est la **moyenne des scores de thématique, pondérée par le nombre de critères testés** dans chaque thématique. Les thématiques non évaluables sont ignorées.

```
global = Σ (poids_t × testés_t × score_t) / Σ (poids_t × testés_t)
```

- `testés_t` : nombre de critères testés dans la thématique `t` ;
- `poids_t` : coefficient de la thématique, défini dans `packages/analyzer/src/config/scoring.json` (champ `weights` ; le même fichier fixe les seuils des paliers, champ `tiers`).

Le score global est arrondi à l'entier.

Avec les coefficients par défaut (tous égaux à 1), le score global revient à :

```
global = 100 × (total des critères conformes) / (total des critères testés)
```

Une thématique où 10 critères ont été testés pèse donc dix fois plus qu'une thématique où un seul l'a été. C'est voulu : un score fondé sur un seul critère est fragile.

Exemple :

| Thématique  | C   | NC  | Testés | Score         |
| ----------- | --- | --- | ------ | ------------- |
| Images      | 3   | 1   | 4      | 75            |
| Couleurs    | 1   | 0   | 1      | 100           |
| Formulaires | 2   | 3   | 5      | 40            |
| Tableaux    | 0   | 0   | 0      | Non évaluable |

Global = (4 × 75 + 1 × 100 + 5 × 40) / (4 + 1 + 5) = 600 / 10 = **60**.

Si aucune thématique n'est évaluable, le score global est lui aussi **Non évaluable**.

## 4. Paliers et libellés

| Score         | Couleur | Icône         | Libellé            |
| ------------- | ------- | ------------- | ------------------ |
| 90 à 100      | vert    | coche         | Peu d'erreurs      |
| 50 à 89       | orange  | triangle      | À corriger         |
| 0 à 49        | rouge   | croix         | Nombreuses erreurs |
| Non évaluable | neutre  | aucune valeur | Non évaluable      |

La couleur n'est jamais seule : chaque palier a aussi son icône et son libellé (critère RGAA 3.1).

« Peu d'erreurs » ne veut pas dire « accessible » : cela veut dire que peu d'erreurs ont été **détectées automatiquement**.

## 5. Couverture

Chaque score affiche sa couverture :

- sous chaque thématique : « 4 critères testés » ;
- au global : « 32 critères testés automatiquement sur 106 ».

La couverture est aussi importante que le score. Un score de 100 obtenu sur 2 critères testés en dit très peu.

## 6. Limites

### Ce qu'un test automatique ne peut pas juger

Les tests automatiques vérifient la **présence** et la **forme** du code. Ils ne jugent pas le **sens**. Par exemple, ils ne peuvent pas dire :

- si l'alternative textuelle d'une image décrit vraiment l'image ;
- si un titre de page ou un intitulé de lien est pertinent ;
- si l'ordre de lecture est logique ou si la navigation au clavier est utilisable ;
- si une information est transmise uniquement par la couleur, la forme ou la position ;
- si un média (vidéo, audio) a des sous-titres ou une transcription fidèles ;
- si un contenu reste lisible quand on agrandit le texte, sauf cas simples ;
- si une page est compréhensible et cohérente avec le reste du site.

C'est pourquoi de nombreux critères restent « À vérifier manuellement », et pourquoi le rapport fournit une liste de vérification.

Les tests peuvent aussi se tromper : faux positifs (erreur signalée à tort) ou faux négatifs (erreur non détectée), notamment sur des pages très dynamiques.

### Pourquoi ce n'est pas un taux de conformité RGAA

|                         | Score Balise                                         | Taux de conformité RGAA (méthode officielle)                                                                                                                                                                      |
| ----------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Périmètre               | Une seule page, au moment de l'analyse               | Un échantillon de pages représentatif du service (pages types, pages pertinentes, pages tirées au hasard)                                                                                                         |
| Critères pris en compte | Uniquement ceux tranchés automatiquement             | Tous les critères applicables, évalués par un auditeur                                                                                                                                                            |
| Méthode                 | Tests automatiques                                   | Audit manuel selon la méthodologie de test du RGAA, outils et technologies d'assistance                                                                                                                           |
| Calcul                  | `C / (C + NC)` par thématique, puis moyenne pondérée | Nombre de critères validés divisé par le nombre de critères applicables ; un critère n'est validé que s'il l'est sur **toutes** les pages de l'échantillon, et il est applicable dès qu'il l'est sur **une** page |
| Usage                   | Repérer et corriger des erreurs                      | Déclaration d'accessibilité (obligation légale pour les organismes concernés)                                                                                                                                     |

La méthode officielle définit aussi un **taux moyen** : la moyenne des taux de conformité de chaque page auditée.

Source : https://accessibilite.numerique.gouv.fr/obligations/evaluation-conformite/ (consulté le 2026-11-05).

En pratique, un score Balise élevé est compatible avec un taux de conformité faible : les critères non testés automatiquement peuvent tous être non conformes.

### Autres limites

- Une analyse porte sur une page dans un état donné : pas d'interaction (menus ouverts, formulaires soumis, fenêtres modales), pas de pages derrière une authentification.
- Le résultat dépend de la version d'axe-core, de Chromium et de la correspondance RGAA, indiquées dans chaque rapport.
- Les poids de thématique sont un choix de présentation, pas une règle du RGAA.
- axe-core et les contrôles maison s'exécutent **dans la page analysée**, à côté de ses propres scripts. Une page peut donc, volontairement ou non, fausser son résultat (masquer des éléments au moment du test, modifier les objets du navigateur). Balise revalide le format des résultats côté serveur et reconstruit lui-même les liens de documentation, mais ne peut pas garantir que la page n'a pas influencé les statuts : c'est une raison de plus de considérer les scores comme indicatifs.
