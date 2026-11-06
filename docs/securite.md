# Sécurité

Ce document décrit le modèle de menace de Balise et les protections mises en place. Le code de référence se trouve dans `packages/analyzer/src/` (`url-guard.ts`, `safe-fetch.ts`, `navigate.ts`, `browser.ts`) et `server/` (`handlers.ts`, `rate-limit.ts`, `store.ts`).

Pour signaler une vulnérabilité : voir `SECURITY.md` (contact `mag.d3v+balise@pm.me`).

## 1. Modèle de menace

Balise charge, à la demande de n'importe quel visiteur anonyme, une page web arbitraire dans un navigateur Chromium exécuté sur l'infrastructure Vercel. C'est par nature un service de requêtes côté serveur : la menace principale est la **falsification de requête côté serveur (SSRF)**.

| Actif à protéger                             | Menace                                                                         | Protection principale                                                       |
| -------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Réseau interne Vercel / AWS, services locaux | SSRF : faire charger `http://127.0.0.1`, `10.x`, `169.254.169.254`…            | Filtre d'adresses à la soumission et à chaque connexion (§ 2)               |
| Identifiants cloud (métadonnées d'instance)  | SSRF vers `169.254.169.254`, `fd00:ec2::254`, `metadata.google.internal`       | Plages link-local et ULA refusées, noms internes refusés                    |
| Disponibilité et budget (fonctions, Redis)   | Abus : analyses en masse, pages énormes, pages qui ne finissent pas de charger | Limitation de débit, plafonds de durée, de taille et de requêtes (§ 3, § 4) |
| Visiteurs de Balise                          | Injection de contenu issu de la page analysée (XSS) dans le rapport            | Échappement systématique, CSP stricte (§ 6)                                 |
| Vie privée des visiteurs                     | Conservation d'adresses IP                                                     | IP jamais stockée en clair : HMAC salé (§ 4)                                |
| Secrets (Upstash, sel)                       | Fuite via le dépôt                                                             | Variables d'environnement Vercel uniquement, aucun secret versionné         |

Hors périmètre : la page analysée elle-même (Balise n'agit pas en son nom), les attaques contre le poste de l'utilisateur hors de l'interface de Balise.

## 2. Protection contre la SSRF

### 2.1 Validation de l'URL soumise (`parseAndValidateUrl`)

- Schémas acceptés : `http:` et `https:` uniquement (`file:`, `data:`, `javascript:`, `ftp:`, `ws:`… refusés).
- Ports acceptés : 80 et 443 uniquement (implicites ou explicites).
- URL avec identifiant ou mot de passe (`https://user:pass@…`) refusées.
- Longueur maximale : 2 048 caractères. Le fragment (`#…`) est retiré.
- L'analyseur WHATWG normalise les notations exotiques d'IPv4 (`http://2130706433/`, `http://0x7f.1/`, `http://017700000001/` deviennent `127.0.0.1`) et convertit les noms internationalisés en punycode : les contrôles portent toujours sur la forme normalisée.

Codes renvoyés : `400 invalid_url` (syntaxe), `422 forbidden_target` (schéma, port, identifiants, adresse non publique), `422 dns_failure` (nom introuvable).

### 2.2 Adresses autorisées (`isPublicAddress`)

Seules les adresses **unicast publiques** sont acceptées.

IPv4 refusées : `0.0.0.0/8`, `10.0.0.0/8`, `100.64.0.0/10` (CGNAT), `127.0.0.0/8`, `169.254.0.0/16` (link-local, dont les métadonnées cloud `169.254.169.254`), `172.16.0.0/12`, `192.0.0.0/24`, `192.0.2.0/24`, `192.88.99.0/24`, `192.168.0.0/16`, `198.18.0.0/15`, `198.51.100.0/24`, `203.0.113.0/24`, `224.0.0.0/4` (multicast), `240.0.0.0/4` et `255.255.255.255`.

IPv6 : seule la plage globale `2000::/3` est acceptée, ce qui exclut `::`, `::1`, `fc00::/7` (ULA, dont `fd00:ec2::254` des métadonnées AWS), `fe80::/10`, `fec0::/10`, le multicast, etc. Les formes qui embarquent une IPv4 sont jugées **sur l'IPv4 embarquée** : IPv4 mappée (`::ffff:127.0.0.1`), IPv4 traduite (`::ffff:0:a.b.c.d`), IPv4 compatible (`::a.b.c.d`), NAT64 (`64:ff9b::/96`, `64:ff9b:1::/48`). Les tunnels 6to4 (`2002::/16`) et Teredo (`2001::/32`), qui peuvent atteindre n'importe quelle IPv4, sont refusés. Les identifiants de zone (`fe80::1%eth0`) sont refusés.

Noms refusés sans résolution : `localhost`, `metadata`, `metadata.google.internal` et les suffixes `.localhost`, `.local`, `.internal`, `.localdomain`, `.home.arpa`.

### 2.3 Résolution DNS côté serveur et DNS rebinding

- À la soumission (`POST /api/analyses`), le nom est résolu côté serveur et **toutes** les adresses A/AAAA doivent être publiques : une seule adresse privée parmi des publiques suffit à refuser.
- Ce contrôle ne suffit pas seul : un attaquant peut répondre une adresse publique au premier appel puis `127.0.0.1` au suivant (DNS rebinding). Balise refait donc le contrôle **au moment de chaque connexion** : `safeFetch` passe aux sockets Node un `lookup` personnalisé qui résout le nom **une seule fois**, vérifie les adresses obtenues et connecte la socket **à ces mêmes adresses**. Il n'existe pas de seconde résolution qu'un attaquant pourrait faire varier.
- Les adresses IP littérales (pour lesquelles Node n'appelle pas `lookup`) sont vérifiées explicitement avant la connexion.
- Le moteur revalide aussi l'URL avec résolution DNS au démarrage de l'analyse.

### 2.4 Toutes les requêtes du navigateur passent par Node

Chromium ne se connecte jamais lui-même au réseau :

1. **Interception Playwright** (`context.route('**/*')`) : chaque requête du contexte (document principal, sous-ressources, cadres, fenêtres surgissantes, `fetch`/XHR) est interceptée, revalidée (schéma, plafonds) puis exécutée par `safeFetch` côté Node, avec la résolution DNS vérifiée décrite ci-dessus. La réponse est rendue au navigateur avec `route.fulfill`.
2. **Redirections** : une réponse 3xx n'est **jamais** rendue au navigateur, car Chromium suit une redirection fournie par `route.fulfill` sans réintercepter le saut suivant. À la place :
   - document principal : Balise sert une page vide, mémorise la cible et lance une nouvelle navigation vers elle, à son tour interceptée et revalidée (la page garde ainsi sa véritable URL et ses URL relatives restent correctes) ;
   - autres requêtes : la redirection est suivie dans Node, chaque saut repassant par `safeFetch` (schéma, port, DNS, adresse) ;
   - cible non http(s) (`file:`, `data:`, `javascript:`…) : refus `forbidden_target`, car ces schémas ne seraient pas interceptés ;
   - au plus 10 redirections, sinon erreur `unreachable`.
     Les tests d'intégration vérifient qu'une redirection vers `127.0.0.1` est refusée **sans que le serveur visé ne reçoive la requête**.
3. **Proxy mort, filet de sécurité** : Chromium est lancé avec `--proxy-server=http://127.0.0.1:9` et `--proxy-bypass-list=<-loopback>`. Une requête qui échapperait malgré tout à l'interception part vers ce proxy inexistant et échoue (`ERR_PROXY_CONNECTION_FAILED`). Ce filet n'est jamais affaibli : un échec de ce type signale un défaut d'interception à corriger, pas une configuration à assouplir.
4. **Autres canaux bloqués** : WebSockets fermés (`routeWebSocket`), service workers bloqués, téléchargements refusés (`acceptDownloads: false`), WebRTC limité au proxy (pas d'UDP direct), préchargement DNS, DNS sur HTTPS et services d'arrière-plan de Chromium désactivés.
5. Une fois le chargement terminé, l'interception reste installée et **refuse toute nouvelle requête** : la page est figée pendant les tests axe-core et les contrôles maison.

### 2.5 Paramètre de test `allowPrivateHosts`

Les tests et la génération des rapports de démonstration (`pnpm demo:build`) doivent charger des pages servies en local. Ils utilisent le paramètre de code `allowPrivateHosts`, qui n'est **jamais lu depuis l'environnement ni exposé par l'API**.

## 3. Limites d'exécution

| Limite                                                          | Valeur                                 | Effet                                                          |
| --------------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------- |
| Chargement (navigation + stabilisation, redirections comprises) | 60 s                                   | `unreachable`                                                  |
| Attente de stabilisation réseau                                 | 500 ms de calme, 10 s au plus          | —                                                              |
| Délai par requête                                               | 20 s                                   | ressource abandonnée                                           |
| Taille d'une ressource (après décompression)                    | 5 Mo                                   | `too_large` sur le document principal, ressource bloquée sinon |
| Taille cumulée de la page                                       | 15 Mo                                  | `too_large`                                                    |
| Nombre de requêtes                                              | 300                                    | requêtes suivantes bloquées                                    |
| Redirections par requête                                        | 10                                     | `unreachable`                                                  |
| Durée totale d'une analyse                                      | 240 s (fonction : `maxDuration` 300 s) | `unreachable`                                                  |
| Corps de `POST /api/analyses`                                   | 8 Kio                                  | `invalid_url`                                                  |
| Document principal non HTML                                     | —                                      | `not_html`                                                     |
| Document principal HTTP ≥ 400                                   | —                                      | `unreachable`                                                  |

Les flux compressés (gzip, deflate, brotli, zstd) sont décompressés en flux et la limite s'applique à la taille décompressée (protection contre les bombes de décompression).

## 4. Limitation de débit et données personnelles

- 10 analyses par heure et par client, fenêtre glissante (`@upstash/ratelimit` en production, implémentation mémoire équivalente en local). Au-delà : `429 rate_limited` avec l'en-tête `Retry-After`.
- L'adresse IP (en-tête `x-real-ip` posé par Vercel, sinon le premier élément de `x-forwarded-for`) n'est **jamais stockée en clair** : la clé est `HMAC-SHA-256(RATE_LIMIT_SALT, ip)`. Les clés expirent avec la fenêtre glissante, bien avant 24 h.
- `RATE_LIMIT_SALT` est un secret obligatoire sur Vercel (au moins 32 octets aléatoires, par exemple `openssl rand -hex 32`). Sans lui, ou sans identifiants Upstash, l'API répond `500 internal` plutôt que de fonctionner en mode dégradé. En local, un sel aléatoire est tiré à chaque démarrage.
- Rapports et captures stockés 30 jours (TTL Redis), puis purgés automatiquement. Les identifiants d'analyse sont aléatoires (21 caractères, `nanoid`), non devinables.

## 5. API

- Erreurs au format `{ "error": { "code", "message" } }`, messages en français, sans détail interne (les causes techniques ne sont que journalisées).
- Réponses JSON avec `Cache-Control: no-store` et `X-Content-Type-Options: nosniff`.
- Identifiants validés (`[A-Za-z0-9_-]{8,64}`) avant tout accès au stockage.
- Annulation (`DELETE`) : l'état « annulé » est stocké ; le traitement le vérifie entre chaque étape et par interrogation périodique, puis interrompt le navigateur.

### Mode de test de bout en bout

`BALISE_E2E_FAKE_ANALYZER=1` remplace le moteur par un faux moteur rapide (sans navigateur ni réseau, URL contenant « unreachable » → erreur `unreachable`) et la résolution DNS de la soumission par une réponse publique fixe ; les adresses IP littérales privées et les noms locaux restent refusés. Dans ce mode seulement, l'en-tête `x-balise-e2e-client` permet à chaque test d'utiliser son propre compteur de limitation de débit. Ce mode est **ignoré si `NODE_ENV=production` ou si `VERCEL` est défini**.

## 6. En-têtes et échappement

- En-têtes posés par `vercel.json` sur toutes les réponses : `Content-Security-Policy` stricte (`default-src 'self'`, pas de script ni de style en ligne, `object-src 'none'`, `frame-ancestors 'none'`, domaines Google Analytics seulement, chargés uniquement après consentement), `Strict-Transport-Security` (2 ans, `preload`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (caméra, micro, géolocalisation désactivés), `X-Frame-Options: DENY`, `Cross-Origin-Opener-Policy: same-origin`.
- Tout contenu issu de la page analysée (titre, sélecteurs, extraits HTML) est stocké **brut** et affiché **échappé** par l'interface : `v-html` est interdit par la règle ESLint `vue/no-v-html`. Les extraits sont tronqués (500 caractères) et les résultats des contrôles maison, calculés dans la page (donc manipulables par ses scripts), sont revalidés côté Node.

## 7. Secrets et dépendances

- Aucun secret dans le dépôt : `KV_REST_API_URL`, `KV_REST_API_TOKEN` et `RATE_LIMIT_SALT` sont des variables d'environnement Vercel (voir `docs/exploitation.md`).
- Dépendances épinglées en version exacte, jamais installées moins de 14 jours après leur publication (`minimumReleaseAge`), surveillées par Dependabot, CodeQL et la revue de dépendances en CI.

## 8. Limites connues

- La lecture puis l'écriture de l'état d'une analyse ne sont pas atomiques : une annulation qui arrive exactement entre les deux peut être écrasée par l'étape suivante ; l'interrogation périodique la rattrape à l'écriture suivante sauf en toute fin d'analyse.
- La page analysée peut détecter Balise (signature `BaliseBot` dans l'agent utilisateur, volontaire) et servir un contenu différent.
- Le délai de 60 s porte sur le chargement ; axe-core sur une page très lourde peut allonger l'analyse, bornée à 240 s au total.
