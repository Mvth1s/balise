# ADR 0001 — Hébergement 100 % Vercel

- Statut : acceptée
- Date : 2026-11-05
- Auteur : Mvth1s

## Contexte

Le cahier des charges initial de Balise prévoyait :

- une API FastAPI (Python) ;
- une file Redis ;
- un worker qui lance le navigateur headless ;
- le tout sur un VPS OVHcloud.

Ce montage demande d'administrer un serveur (mises à jour, sécurité, supervision, sauvegardes). Pour un projet personnel, nous voulons un déploiement sans serveur à maintenir, avec prévisualisation automatique de chaque PR.

Une analyse dure de quelques secondes à environ une minute : chargement de la page (plafonné à 60 s), exécution d'axe-core, capture d'écran, calcul des scores. Elle doit donc tenir dans la durée maximale d'une fonction serverless.

Faits vérifiés dans la documentation officielle de Vercel le 2026-11-05 :

| Point                          | Valeur (offre Hobby)                                                        | Source                                                              |
| ------------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Durée maximale (`maxDuration`) | 300 s par défaut et au maximum                                              | https://vercel.com/docs/functions/limitations                       |
| Mémoire / CPU                  | 2 Go / 1 vCPU (défaut et maximum)                                           | https://vercel.com/docs/functions/limitations                       |
| Taille d'une fonction          | 250 Mo non compressés (au-delà : « large functions » jusqu'à 5 Go, en bêta) | https://vercel.com/docs/functions/limitations                       |
| Région de Paris                | `cdg1`                                                                      | https://vercel.com/docs/regions                                     |
| Versions de Node.js            | 26.x (défaut), 24.x, 22.x                                                   | https://vercel.com/docs/functions/runtimes/node-js/node-js-versions |

## Décision

Tout Balise est hébergé sur Vercel :

- **Front** : Vue 3 + Vite, pages statiques pré-rendues (vite-ssg).
- **API** : Vercel Functions, runtime Node.js, région `cdg1`, `maxDuration` 300 s. Les fichiers de `api/` sont minces ; la logique est dans `server/` (voir [ADR 0003](0003-structure-depot.md)).
- **Asynchrone sans worker** : `POST /api/analyses` valide l'URL, crée l'analyse, répond `202` avec un identifiant, puis poursuit le travail dans la même invocation grâce à `waitUntil` (`@vercel/functions`). Le front interroge `GET /api/analyses/:id`.
- **Navigateur** : `playwright-core` + `@sparticuz/chromium` (Chromium compressé pour serverless), même version majeure de Chromium (153) des deux côtés.
- **Stockage et limitation de débit** : Upstash Redis via la marketplace Vercel (voir [ADR 0002](0002-stockage-upstash.md)).
- **Node.js 24.x**. Vercel propose 26.x par défaut. Nous retenons 24.x, version LTS, pour la compatibilité avec `@sparticuz/chromium` et pour aligner l'environnement local, la CI et la production (`.nvmrc`, `engines`).

## Conséquences

Positives :

- Aucun serveur à administrer. HTTPS, CDN, prévisualisations par PR et retour arrière fournis par la plateforme.
- Coût nul tant que l'usage reste dans les limites de l'offre Hobby.
- Fonctions exécutées à Paris, près des utilisateurs visés.

Négatives et risques :

- **Durée** : une analyse ne peut pas dépasser 300 s, réponse comprise. Le chargement de page est plafonné à 60 s pour garder une marge.
- **Taille** : Chromium + Playwright + axe-core doivent tenir dans 250 Mo non compressés. Chaque mise à jour de ces dépendances doit être vérifiée.
- **Mémoire** : 2 Go et 1 vCPU. Des pages très lourdes peuvent échouer.
- **Concurrence** : chaque analyse occupe une invocation complète. Pas de file d'attente : la limitation de débit (10 analyses par heure et par IP) protège le service.
- **`waitUntil`** : si l'invocation est interrompue, l'analyse reste inachevée. Le front doit traiter ce cas (état `error` ou délai dépassé).
- **Dépendance à un fournisseur américain** : transferts de données encadrés (voir la politique de confidentialité).

## Chemin de migration vers un VPS OVHcloud

L'architecture est pensée pour que l'API ne change pas si l'exécution des analyses quitte Vercel.

1. **Worker conteneurisé** : extraire l'exécution du moteur (`packages/analyzer`) dans un service Node.js packagé en image Docker basée sur l'image officielle Playwright (`mcr.microsoft.com/playwright`), qui embarque Chromium et ses dépendances système. `@sparticuz/chromium` n'est plus nécessaire : on utilise le Chromium de Playwright.
2. **File Redis** : remplacer `waitUntil` par une file. `POST /api/analyses` pousse un travail dans Redis (Upstash ou Redis auto-hébergé sur le VPS) ; le worker consomme la file, met à jour l'état de l'analyse et écrit le rapport.
3. **API inchangée** : les handlers de `server/` restent identiques. Seule l'étape « lancer l'analyse » change d'implémentation. Le stockage passe par l'interface `AnalysisStore` : un nouvel adaptateur (Redis auto-hébergé, PostgreSQL…) suffit si l'on quitte Upstash.
4. **Front et API** peuvent rester sur Vercel, ou migrer à leur tour : les handlers de `server/` reçoivent une `Request` et renvoient une `Response` (API Web standard), ce qui les rend exécutables par n'importe quel serveur HTTP Node.js.
5. **Sécurité** : le filtre SSRF, les plafonds (60 s, taille, nombre de requêtes) et l'interception des requêtes restent dans le moteur et suivent donc le worker. Sur un VPS, ajouter une isolation réseau (pare-feu sortant interdisant les plages privées et l'adresse de métadonnées) en défense en profondeur.

### Déclencheurs de migration

Migrer si l'un de ces signaux devient durable :

- **Temps d'analyse** : des analyses légitimes approchent ou dépassent la limite de 300 s.
- **Taille de fonction** : le paquet dépasse 250 Mo non compressés et les « large functions » ne conviennent pas.
- **Coûts** : l'usage dépasse l'offre gratuite et une offre payante coûte plus cher qu'un VPS.
- **Besoin de concurrence** : il faut une file d'attente, des priorités, des analyses multi-pages ou une concurrence contrôlée que `waitUntil` ne permet pas.

## Alternatives étudiées

- **Cahier des charges initial (FastAPI + Redis + worker sur VPS OVHcloud)** : plus souple (pas de limite de durée ni de taille), mais serveur à maintenir et pas de prévisualisation par PR intégrée. Conservé comme cible de migration.
- **Vercel Workflow ou Vercel Queues** : permettraient des traitements plus longs et une vraie file. Écartés pour la v1 : `waitUntil` suffit tant qu'une analyse tient en 300 s, et cela limite les dépendances. À reconsidérer avant une migration vers un VPS.
- **Navigateur distant (service de navigateurs headless hébergé)** : supprime la contrainte de taille, mais ajoute un tiers qui voit les pages analysées et un coût récurrent.
