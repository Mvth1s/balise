# Politique de sécurité

## Signaler une vulnérabilité

Merci de **ne pas ouvrir de ticket public** pour une vulnérabilité. Signalez-la de manière privée, au choix :

- via les [avis de sécurité GitHub](https://github.com/Mvth1s/balise/security/advisories/new) (« Report a vulnerability ») ;
- par courriel à [mag.d3v+balise@pm.me](mailto:mag.d3v+balise@pm.me).

Indiquez si possible :

- la description du problème et son impact ;
- les étapes pour le reproduire (URL analysée, requête, charge utile) ;
- la version ou le commit concerné ;
- vos coordonnées si vous souhaitez être cité·e dans l'avis publié.

N'incluez aucune donnée personnelle de tiers. N'effectuez pas de test qui dégrade le service pour les autres personnes (déni de service, envoi massif d'analyses) et ne consultez pas de données qui ne vous appartiennent pas.

## Périmètre

Sont concernés :

- le code de ce dépôt (front `apps/web`, API `api/` et `server/`, moteur `packages/analyzer`, référentiel `packages/rgaa-mapping`) ;
- l'instance publique de Balise hébergée sur Vercel ;
- en particulier : contournement du filtre SSRF (accès à des adresses privées, réservées, de bouclage, link-local ou de métadonnées, DNS rebinding, redirections), injection de contenu issu des pages analysées (XSS), contournement de la limitation de débit, fuite de secrets ou de données d'analyse, en-têtes de sécurité et CSP.

Hors périmètre :

- les vulnérabilités des services tiers (Vercel, Upstash, Google) : signalez-les à leurs éditeurs ;
- la page `/demo/avant`, qui contient volontairement des erreurs d'accessibilité (mais pas de faille de sécurité) ;
- les rapports issus uniquement d'outils automatiques sans démonstration d'impact ;
- l'absence de bonnes pratiques sans impact exploitable.

## Délais indicatifs

Balise est un projet personnel maintenu bénévolement. À titre indicatif :

| Étape                                   | Délai visé          |
| --------------------------------------- | ------------------- |
| Accusé de réception                     | 5 jours ouvrés      |
| Première évaluation                     | 10 jours ouvrés     |
| Correction d'une vulnérabilité critique | 30 jours            |
| Publication de l'avis de sécurité       | après la correction |

Nous vous tiendrons informé·e de l'avancement et conviendrons avec vous de la date de divulgation publique.

## Versions prises en charge

Seule la dernière version publiée (branche `main`, déployée en production) reçoit des correctifs de sécurité.
