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
| Secrets (Upstash, sel, clé de signature)     | Lecture par du code exécuté via une faille de Chromium                         | Chromium dans un projet Vercel séparé, sans aucun secret (§ 9)              |

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
   - autres requêtes : la redirection est suivie dans Node, chaque saut repassant par `safeFetch` (schéma, port, DNS, adresse), **dans la même origine seulement** : une redirection de sous-ressource vers une autre origine est bloquée. Les en-têtes fournis par le navigateur (`Cookie`, `Authorization`…) ne partent donc jamais vers une origine différente de celle pour laquelle il les a calculés ;
   - cible non http(s) (`file:`, `data:`, `javascript:`…) : refus `forbidden_target`, car ces schémas ne seraient pas interceptés ;
   - au plus 10 redirections, sinon erreur `unreachable`.
     Les tests d'intégration vérifient qu'une redirection vers `127.0.0.1` est refusée **sans que le serveur visé ne reçoive la requête**.
3. **Proxy mort, filet de sécurité** : Chromium est lancé avec `--proxy-server=http://127.0.0.1:9` et `--proxy-bypass-list=<-loopback>`. Une requête qui échapperait malgré tout à l'interception part vers ce proxy inexistant et échoue (`ERR_PROXY_CONNECTION_FAILED`). Ce filet n'est jamais affaibli : un échec de ce type signale un défaut d'interception à corriger, pas une configuration à assouplir.
4. **Méthodes** : seules les requêtes `GET` et `HEAD` sans corps sont exécutées ; toute autre requête de la page (`POST` de formulaire, `fetch` en `PUT`…) est abandonnée. Une page analysée n'a aucune raison d'envoyer des données, et Balise ne doit pas servir de relais pour en envoyer.
5. **Autres canaux bloqués** : WebSockets fermés (`routeWebSocket`), service workers bloqués, téléchargements refusés (`acceptDownloads: false`), WebRTC limité au proxy (pas d'UDP direct), QUIC désactivé (`--disable-quic`), préchargement DNS, DNS sur HTTPS et services d'arrière-plan de Chromium désactivés.
6. Une fois le chargement terminé, l'interception reste installée et **refuse toute nouvelle requête** : la page est figée pendant les tests axe-core et les contrôles maison.

### 2.5 Arguments de Chromium (`buildLaunchArgs`, `browser.ts`)

- Sur Vercel, les arguments fournis par `@sparticuz/chromium` sont filtrés : `--disable-web-security` (politique de même origine), `--allow-running-insecure-content`, `--disable-site-isolation-trials` et `--enable-features=SharedArrayBuffer` sont retirés. Le mode graphique est désactivé (`setGraphicsMode = false` : ni WebGL ni SwiftShader).
- `--js-flags=--jitless` désactive les compilateurs JIT de V8, principale source d'exploits du moteur JavaScript (WebAssembly est alors indisponible : les pages qui en dépendent sont analysées sans).
- Chromium ne retient que la **dernière** occurrence d'un argument : les listes `--disable-features` de Playwright (copie épinglée pour 1.63.0, à revérifier à chaque mise à jour), de Sparticuz et de Balise sont fusionnées en un seul argument, et l'argument par défaut de Playwright est retiré (`ignoreDefaultArgs`). Un test unitaire vérifie la construction.
- Ces choix sont testés en local avec le Chromium de Playwright ; le binaire Sparticuz n'est vérifié qu'en préversion Vercel.

### 2.6 Paramètre de test `allowPrivateHosts`

Les tests et la génération des rapports de démonstration (`pnpm demo:build`) doivent charger des pages servies en local. Ils utilisent le paramètre de code `allowPrivateHosts`, qui n'est **jamais lu depuis l'environnement ni exposé par l'API**.

## 3. Limites d'exécution

| Limite                                                                             | Valeur                                 | Effet                                                          |
| ---------------------------------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------- |
| Chargement (navigation + stabilisation, redirections comprises)                    | 60 s                                   | `unreachable`                                                  |
| Attente de stabilisation réseau                                                    | 500 ms de calme, 10 s au plus          | —                                                              |
| Délai par requête                                                                  | 20 s                                   | ressource abandonnée                                           |
| Taille d'une ressource (après décompression)                                       | 5 Mo                                   | `too_large` sur le document principal, ressource bloquée sinon |
| Taille cumulée de la page (réservée au fil du flux, requêtes parallèles comprises) | 15 Mo                                  | `too_large`                                                    |
| Nombre de requêtes                                                                 | 300                                    | requêtes suivantes bloquées                                    |
| Redirections par requête                                                           | 10                                     | `unreachable`                                                  |
| Durée totale d'une analyse                                                         | 240 s (fonction : `maxDuration` 300 s) | `unreachable`                                                  |
| Analyse en cours sans mise à jour (traitement perdu)                               | 300 s                                  | `internal`, écrit à la lecture suivante                        |
| Corps de `POST /api/analyses` (taille déclarée ou lue)                             | 8 Kio                                  | `invalid_url`                                                  |
| Document principal non HTML                                                        | —                                      | `not_html`                                                     |
| Document principal HTTP ≥ 400                                                      | —                                      | `unreachable`                                                  |

L'analyse est interruptible pendant **toute** sa durée : l'annulation ou le plafond de 240 s ferment le navigateur, ce qui interrompt aussi axe-core et les contrôles maison (un script de la page bloqué dans une boucle infinie ne retient pas l'analyse ; test d'intégration dédié). Côté serveur, le plafond est appliqué par `Promise.race` même si le moteur ne réagissait pas au signal, puis l'erreur `unreachable` est enregistrée. Si la fonction elle-même est arrêtée par Vercel (`maxDuration`), l'analyse restée « en cours » plus de 300 s est déclarée en erreur `internal` à la lecture suivante.

Les flux compressés (gzip, deflate, brotli, zstd) sont décompressés en flux et la limite s'applique à la taille décompressée (protection contre les bombes de décompression).

## 4. Limitation de débit et données personnelles

- 10 analyses par heure et par client, fenêtre glissante (`@upstash/ratelimit` en production, implémentation mémoire équivalente en local). Un client est une adresse IPv4 (IPv4 mappée comprise) ou un **préfixe IPv6 /64**, qu'un même abonné possède en entier. Au-delà : `429 rate_limited` avec l'en-tête `Retry-After`.
- Plafond global de 100 analyses par heure pour tout le service (clé `global`), vérifié après la limite par client pour qu'un client bloqué ne consomme pas le budget commun. Il borne le coût en cas d'attaque distribuée. Il n'est pas appliqué en mode de test de bout en bout.
- L'adresse IP (`ipAddress()` de `@vercel/functions`, c'est-à-dire l'en-tête `x-real-ip` que Vercel réécrit, sinon le premier élément de `x-forwarded-for` en local) n'est **jamais stockée en clair** : la clé est `HMAC-SHA-256(RATE_LIMIT_SALT, client)`. Les clés expirent avec la fenêtre glissante, bien avant 24 h.
- `RATE_LIMIT_SALT` est un secret obligatoire sur Vercel (au moins 32 octets aléatoires, par exemple `openssl rand -hex 32`). Sans lui, ou sans identifiants Upstash, l'API répond `500 internal` plutôt que de fonctionner en mode dégradé. En local, un sel aléatoire est tiré à chaque démarrage.
- Rapports et captures stockés 30 jours (TTL Redis), puis purgés automatiquement. Les identifiants d'analyse sont aléatoires (21 caractères, `nanoid`), non devinables.

## 5. API

- Erreurs au format `{ "error": { "code", "message" } }`, messages en français, sans détail interne (les causes techniques ne sont que journalisées).
- Réponses JSON avec `Cache-Control: no-store` et `X-Content-Type-Options: nosniff`.
- Identifiants validés (`[A-Za-z0-9_-]{8,64}`) avant tout accès au stockage.
- `POST /api/analyses` exige `Content-Type: application/json` (`415 unsupported_media_type` sinon) : un formulaire HTML d'un autre site ne peut pas envoyer ce type sans requête de prévalidation CORS, que Balise n'accepte pas. Les requêtes `Sec-Fetch-Site: cross-site` sont refusées (`403 forbidden_origin`). Ensemble, ces contrôles empêchent un site tiers de consommer le quota de ses visiteurs.
- Le corps est lu en flux et abandonné au-delà de 8 Kio ; un `Content-Length` supérieur est refusé avant toute lecture.
- Annulation (`DELETE`) : l'état « annulé » est stocké ; le traitement le vérifie entre chaque étape et par interrogation périodique, puis interrompt le navigateur.

### Mode de test de bout en bout

`BALISE_E2E_FAKE_ANALYZER=1` remplace le moteur par un faux moteur rapide (sans navigateur ni réseau, URL contenant « unreachable » → erreur `unreachable`) et la résolution DNS de la soumission par une réponse publique fixe ; les adresses IP littérales privées et les noms locaux restent refusés. Dans ce mode seulement, l'en-tête `x-balise-e2e-client` permet à chaque test d'utiliser son propre compteur de limitation de débit. Ce mode est **ignoré si `NODE_ENV=production` ou si `VERCEL` est défini**.

## 6. En-têtes et échappement

- En-têtes posés par `vercel.json` sur toutes les réponses : `Content-Security-Policy` stricte (`default-src 'self'`, pas de script ni de style en ligne, `object-src 'none'`, `frame-ancestors 'none'`, scripts externes limités au chemin `https://www.googletagmanager.com/gtag/` et chargés uniquement après consentement), `Strict-Transport-Security` (2 ans, `preload`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (caméra, micro, géolocalisation, paiement, USB et Topics désactivés ; `interest-cohort` est omis car Chromium ne le reconnaît plus et l'afficherait en avertissement dans la console), `X-Frame-Options: DENY`, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`.
- Tout contenu issu de la page analysée (titre, sélecteurs, extraits HTML) est stocké **brut** et affiché **échappé** par l'interface : `v-html` est interdit par la règle ESLint `vue/no-v-html`. Les extraits sont tronqués (500 caractères) et les résultats d'axe-core et des contrôles maison, calculés dans la page (donc manipulables par ses scripts), sont revalidés côté Node : types vérifiés, sélecteurs tronqués à 1 000 caractères, lien de documentation axe reconstruit côté serveur à partir de l'identifiant de règle (jamais repris de la page).

## 7. Secrets et dépendances

- Aucun secret dans le dépôt : `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `RATE_LIMIT_SALT` et `BALISE_TOKEN_PRIVATE_KEY` sont des variables d'environnement Vercel du projet `balise` (voir `docs/exploitation.md`). Le projet `balise-worker` n'en reçoit aucune.
- Audit hebdomadaire `pnpm audit --prod --audit-level high` (`.github/workflows/audit.yml`). Les correctifs de dépendances transitives passent par `overrides` dans `pnpm-workspace.yaml` (par exemple `zod` sous `@vercel/cli-config`).
- Dépendances épinglées en version exacte, jamais installées moins de 14 jours après leur publication (`minimumReleaseAge`), surveillées par Dependabot, CodeQL et la revue de dépendances en CI.

## 8. Limites connues

- La lecture puis l'écriture de l'état d'une analyse ne sont pas atomiques : une annulation qui arrive exactement entre les deux peut être écrasée par l'étape suivante ; l'interrogation périodique la rattrape à l'écriture suivante sauf en toute fin d'analyse.
- La page analysée peut détecter Balise (signature `BaliseBot` dans l'agent utilisateur, volontaire) et servir un contenu différent.
- Le délai de 60 s porte sur le chargement ; axe-core sur une page très lourde peut allonger l'analyse, bornée à 240 s au total.
- **Chromium sans bac à sable sur Vercel** : l'environnement Lambda n'offre pas les espaces de noms nécessaires, `@sparticuz/chromium` impose `--no-sandbox` et `--single-process`, et l'isolation des sites (`IsolateOrigins`, `site-per-process`) reste désactivée, sans objet en processus unique. Une faille du moteur de rendu exploitée par une page donne donc l'exécution de code dans la fonction. Atténuations : JIT désactivé, Chromium à jour (même majeure que `playwright-core`), aucune requête réseau directe possible (proxy mort, interception), fonction éphémère.
- **Worker compromis** : du code exécuté via Chromium peut envoyer un faux rapport **pour l'analyse en cours uniquement** (il détient son jeton), ou rejouer pendant 280 s l'appel de déclenchement reçu. Il ne peut ni lire ni écrire d'autres analyses, ni contourner la limitation de débit, ni fabriquer de jeton (§ 9).
- **Progression** : le worker ne pouvant pas écrire, l'état passe de « Prise en charge » à « Terminé » sans étapes intermédiaires côté serveur ; l'interface affiche les étapes au rythme minimal de 600 ms.
- **Distinction `dns_failure`** : un nom inexistant répond `dns_failure` et non `forbidden_target`. Un attaquant peut ainsi savoir si un nom se résout depuis l'infrastructure, information déjà publique pour les noms publics ; les noms internes (`.internal`, `.local`…) sont refusés avant toute résolution. Le code est conservé car il aide l'utilisateur à corriger une faute de frappe.

## 9. Isolation de Chromium

Sur Vercel, les variables d'environnement sont communes à toutes les fonctions d'un projet. Chromium tourne donc dans un **projet Vercel distinct**, `balise-worker` (dossier `worker/`, racine du projet = `worker`), qui ne reçoit que deux variables non secrètes : `BALISE_TOKEN_PUBLIC_KEY` et `BALISE_API_ORIGIN`.

```
navigateur ──POST /api/analyses──▶ balise (Redis, sel, clé privée)
                                     │ 1. valide l'URL, limite le débit, enregistre « pending »
                                     │ 2. stocke un nonce, signe un jeton Ed25519 {id, url, exp, nonce}
                                     ▼
                         balise-worker POST /api/run {id, url, token}
                                     │ 3. vérifie la signature (clé publique), l'id et l'URL
                                     │ 4. revalide la cible (filtre SSRF), lance Chromium
                                     │    (annulation lue sur GET /api/analyses/:id, public)
                                     ▼
              balise POST /api/analyses/:id/report  (Authorization: Bearer <jeton>)
                                       5. vérifie signature, expiration, id ; consomme le nonce
                                          (GETDEL atomique : usage unique) ; valide le rapport ; écrit
```

- **Seule la fonction `balise` écrit dans Redis.** Le worker refuse de démarrer (`500`, journal « configuration refusée ») si une variable `KV_*`, `UPSTASH_*`, `REDIS_*`, `RATE_LIMIT_SALT` ou `BALISE_TOKEN_PRIVATE_KEY` est présente (`server/worker.ts`, `FORBIDDEN_WORKER_ENV`).
- **Jeton** (`server/report-token.ts`) : signature Ed25519, clé privée détenue par `balise` seulement ; durée de vie 280 s (au-dessus de la limite d'analyse de 240 s, sous la durée maximale de 300 s) ; lié à l'id et à l'URL ; à usage unique grâce au nonce stocké dans Redis et supprimé atomiquement par l'écrivain avant toute lecture du corps.
- **Rapport reçu** (`server/worker-result.ts`) : corps limité à 4 Mo, forme vérifiée (version, id identique, critères bornés), capture acceptée seulement si elle commence par la signature JPEG, codes d'erreur restreints à la liste connue. L'interface échappe toujours le contenu (§ 6).
- **Sur Vercel, le mode isolé est obligatoire** : sans `BALISE_WORKER_URL` (https) et `BALISE_TOKEN_PRIVATE_KEY`, l'API répond `500 internal`. En local et en test, l'analyse tourne dans le processus (pas de secret réel).
- Génération des clés (à faire hors du dépôt) :

  ```sh
  node -e "const {generateKeyPairSync:g}=require('node:crypto');const k=g('ed25519');console.log('PRIVATE',k.privateKey.export({format:'der',type:'pkcs8'}).toString('base64'));console.log('PUBLIC',k.publicKey.export({format:'der',type:'spki'}).toString('base64'))"
  ```

## 10. Jugement par IA (Mistral)

- `MISTRAL_API_KEY` (et `MISTRAL_MODEL`, facultatif, défaut `mistral-small-2603`) n'existent **que dans le projet `balise`**. Le worker refuse de démarrer si une variable `MISTRAL_*` est présente (`FORBIDDEN_WORKER_ENV`). Sans clé, la couche IA est désactivée et le rapport est identique.
- Le worker collecte un paquet borné (`packages/analyzer/src/judge-pack.ts` : 8 images recadrées de 120 Ko au plus, 40 liens, 60 titres, 30 champs, 30 boutons, 10 cadres, 5 tableaux, 30 passages, textes tronqués à 200 caractères), revalidé par `sanitizeJudgePack` à la réception. L'API appelle Mistral en deux requêtes groupées au plus (images, texte), 1 requête par seconde au plus, nouvelles tentatives sur 429 et 5xx (`Retry-After` respecté), délai total de 60 s ; la fonction d'écriture a une durée maximale de 120 s.
- **Injection de consignes** : le contenu de la page est transmis comme données (`<donnees>…</donnees>`) et le modèle doit ignorer toute consigne qu'il contient. Une page peut néanmoins tenter d'influencer le verdict. Garde-fous : sortie imposée par schéma JSON (`strict`) puis revalidée (identifiants de critères attendus seulement, verdict, confiance de 0 à 1, justification ≤ 300 caractères), sélecteurs conservés seulement s'ils figurent dans le paquet, confiance minimale de 0,6, résultat automatique toujours prioritaire, statuts distincts « (IA) », exclus des scores, avec mention « à confirmer par une vérification humaine ». La justification est affichée échappée, comme tout contenu.
- **Vie privée** : le contenu de pages publiques est envoyé à Mistral AI ; sur l'offre gratuite « Experiment », il peut servir à l'entraînement (désactivable par l'éditeur dans la console Mistral, menu Privacy). Voir la politique de confidentialité.
- **Fiabilité** : jeu de pages de test avec verdicts attendus (`server/ai/eval/pages.ts`), mesuré par `scripts/ai-eval.ts` avec une vraie clé.
