# ADR 0002 — Stockage sur Upstash Redis

- Statut : acceptée
- Date : 2026-11-05
- Auteur : Mvth1s

## Contexte

Balise doit stocker :

- l'état d'avancement de chaque analyse (étape en cours, erreur éventuelle) ;
- le rapport final et la capture d'écran, consultables par URL pendant 30 jours ;
- les compteurs de limitation de débit (10 analyses par heure et par IP hachée).

Les fonctions Vercel sont sans état : deux requêtes successives (création puis interrogation) peuvent être servies par des instances différentes. Il faut donc un stockage externe, accessible en HTTP depuis une fonction serverless, avec expiration automatique des données.

Contraintes :

- données personnelles minimales et purge automatique (RGPD) ;
- région Europe ;
- pas de serveur à administrer ([ADR 0001](0001-hebergement-vercel.md)) ;
- possibilité de changer de fournisseur.

## Décision

- **Upstash Redis**, provisionné via la marketplace Vercel, dans une région Europe. Les variables `KV_REST_API_URL` et `KV_REST_API_TOKEN` sont injectées par l'intégration.
- **Client** `@upstash/redis` (API REST, adaptée au serverless : pas de connexion TCP persistante).
- **Expiration native** : chaque clé d'analyse (état, rapport, capture) est écrite avec un TTL de 30 jours. Redis supprime les données à l'échéance, sans tâche de purge.
- **Limitation de débit** : `@upstash/ratelimit`, 10 analyses par heure. La clé est une empreinte HMAC-SHA256 de l'adresse IP, avec un sel secret (`RATE_LIMIT_SALT`). Les clés expirent au plus tard après 24 heures. L'adresse IP n'est jamais stockée en clair.
- **Abstraction** : le code n'utilise Redis qu'à travers l'interface `AnalysisStore` (dans `server/`). Deux implémentations :
  - Upstash Redis en production et en prévisualisation ;
  - un stockage en mémoire en local et dans les tests, utilisé quand les variables Upstash sont absentes.

## Conséquences

Positives :

- Purge à 30 jours garantie par le TTL, sans code de maintenance.
- Aucun serveur de base de données à gérer.
- Tests unitaires et d'intégration sans dépendance réseau grâce au stockage en mémoire.
- Changement de fournisseur limité à un nouvel adaptateur `AnalysisStore`.

Négatives et risques :

- Les captures d'écran (JPEG) occupent la plus grande part du volume. Leur taille et leur qualité restent plafonnées (zone visible 1280 × 800, qualité 60) pour tenir dans les quotas de l'offre gratuite. Quotas de l'offre Free relevés sur https://upstash.com/pricing/redis le 2026-11-06 : 500 000 commandes par mois, 10 Go de bande passante par mois, requête de 10 Mo et enregistrement de 100 Mo au plus, données de 250 Mo (la même page indique aussi 256 Mo dans son tableau comparatif). Avec un rapport et une capture de quelques centaines de kilo-octets conservés 30 jours, le volume de données est la première limite à surveiller. [À COMPLÉTER : offre Upstash effectivement souscrite via la marketplace Vercel, si ce n'est pas l'offre Free]
- Upstash, Inc. est une société américaine : transfert encadré par le Data Privacy Framework UE–États-Unis, auquel Upstash déclare adhérer (https://upstash.com/trust/privacy.pdf, consulté le 2026-11-05).
- Le stockage en mémoire ne doit jamais servir en production : il ne partage rien entre instances.

## Alternatives étudiées

- **Vercel Blob** pour les rapports et captures : adapté aux fichiers, mais pas d'expiration native par objet ni de compteur atomique pour la limitation de débit. Il aurait fallu un second service.
- **Base Postgres (Neon via la marketplace)** : plus riche que nécessaire, purge à programmer (tâche planifiée), connexions plus coûteuses en serverless.
- **Redis auto-hébergé sur VPS** : cohérent avec le cahier des charges initial, mais serveur à administrer. Reste une option si Balise migre vers OVHcloud (voir ADR 0001).
