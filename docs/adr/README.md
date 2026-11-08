# Décisions d'architecture (ADR)

Chaque ADR décrit une décision importante : son contexte, la décision, ses conséquences et les alternatives écartées. Une ADR acceptée n'est pas réécrite : si la décision change, une nouvelle ADR la remplace et l'ancienne passe au statut « remplacée ».

| N°                                          | Titre                                                           | Statut   | Date       |
| ------------------------------------------- | --------------------------------------------------------------- | -------- | ---------- |
| [0001](0001-hebergement-vercel.md)          | Hébergement 100 % Vercel (et chemin de migration vers OVHcloud) | acceptée | 2026-11-05 |
| [0002](0002-stockage-upstash.md)            | Stockage sur Upstash Redis                                      | acceptée | 2026-11-05 |
| [0003](0003-structure-depot.md)             | Structure du dépôt (monorepo pnpm, `server/` séparé de `api/`)  | acceptée | 2026-11-05 |
| [0004](0004-bandeau-consentement-maison.md) | Consentement maison (popup modale)                              | acceptée | 2026-11-05 |
| [0005](0005-mapping-rgaa.md)                | Correspondance règles de test → critères RGAA                   | acceptée | 2026-11-05 |

## Ajouter une ADR

1. Copier le format d'une ADR existante : titre, statut, date, auteur, puis les sections Contexte, Décision, Conséquences, Alternatives étudiées.
2. Numéroter à la suite (`0006-…`), nom de fichier en minuscules avec tirets.
3. Citer les sources officielles consultées, avec la date.
4. Ajouter la ligne dans le tableau ci-dessus.
