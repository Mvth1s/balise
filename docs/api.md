# API

L'API de Balise sert à lancer une analyse, suivre son avancement, récupérer le rapport et la capture d'écran. Elle est publique, sans authentification, et limitée à 10 analyses par heure et par adresse IP.

- Base : `https://balise-tau.vercel.app/api` ; en local, `http://localhost:<port>/api` avec `pnpm dev:api`.
- Format : JSON (UTF-8), sauf la capture d'écran (`image/jpeg`).
- Types de référence : `packages/analyzer/src/types.ts` (importables en type seul : `@balise/analyzer/types`).
- Client du front : `apps/web/src/lib/api.ts`.

> **Scores indicatifs.** Les scores renvoyés ne constituent pas un taux de conformité RGAA et ne doivent pas être repris dans une déclaration d'accessibilité.

> **Contenu non fiable.** Les champs issus de la page analysée (`page.title`, `finalUrl`, `selector`, `html`) sont stockés bruts. Tout client doit les afficher comme du texte, jamais comme du HTML.

## Points d'accès

| Méthode  | Chemin                         | Rôle                           | Succès                   |
| -------- | ------------------------------ | ------------------------------ | ------------------------ |
| `POST`   | `/api/analyses`                | Lancer une analyse             | `202 { id, url, state }` |
| `GET`    | `/api/analyses/:id`            | État, étape, erreur ou rapport | `200 AnalysisStatus`     |
| `DELETE` | `/api/analyses/:id`            | Annuler une analyse en cours   | `202 AnalysisStatus`     |
| `GET`    | `/api/analyses/:id/screenshot` | Capture d'écran de la page     | `200 image/jpeg`         |

### `POST /api/analyses`

Lance l'analyse d'une page publique. La réponse arrive dès que l'URL est validée ; l'analyse continue ensuite côté serveur (voir [`architecture.md`](architecture.md)).

Corps :

```json
{ "url": "https://exemple.fr/page" }
```

Contrôles effectués avant la réponse, dans cet ordre (`server/handlers.ts`) :

1. origine : une requête portant `Sec-Fetch-Site: cross-site` (envoyée depuis un autre site par un navigateur) est refusée ;
2. type : l'en-tête `Content-Type` doit valoir `application/json` (paramètres comme `charset` acceptés) ;
3. corps : objet JSON de 8 Kio au plus (taille déclarée ou lue), avec un champ `url` de type chaîne ;
4. syntaxe de l'URL : chaîne non vide, 2 048 caractères au plus, URL absolue, schéma `http` ou `https`, port 80 ou 443, sans identifiant ni mot de passe. Une requête refusée à cette étape ne compte pas dans la limite ;
5. limitation de débit : 10 analyses par heure et par client (adresse IPv4, ou préfixe /64 en IPv6), puis 100 analyses par heure pour l'ensemble du service, en fenêtres glissantes ;
6. cible : nom d'hôte non interdit et toutes les adresses DNS publiques. Le fragment (`#…`) est retiré.

Réponse `202 Accepted`, avec l'en-tête `Location: /api/analyses/<id>` :

```json
{
  "id": "[identifiant opaque]",
  "url": "https://exemple.fr/page",
  "state": "pending"
}
```

L'identifiant est généré par `nanoid` (21 caractères `A-Za-z0-9_-`). Considérez-le comme opaque. Un identifiant qui ne respecte pas le motif `^[A-Za-z0-9_-]{8,64}$` répond `404 not_found` sans accès au stockage. Il sert aussi dans l'adresse du rapport partageable, `/analyses/:id`.

À la création, l'analyse est enregistrée avec `state: "pending"` et `step: "validated"`. L'analyse elle-même dure au plus 240 s (sous la limite de 300 s de la fonction) ; au-delà, elle passe en erreur `unreachable` avec le message « L'analyse a dépassé la durée maximale autorisée. ».

```sh
curl -sS -X POST https://balise-tau.vercel.app/api/analyses \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://exemple.fr/"}'
```

### `GET /api/analyses/:id`

Renvoie l'état de l'analyse (`AnalysisStatus`). Interrogez ce point d'accès à intervalle régulier jusqu'à un état final : `done`, `error` ou `cancelled`. [À COMPLÉTER : intervalle d'interrogation retenu par le front.]

```sh
curl -sS https://balise-tau.vercel.app/api/analyses/<id>
```

Exemple pendant l'analyse :

```json
{
  "id": "<id>",
  "url": "https://exemple.fr/",
  "state": "running",
  "step": "loading",
  "createdAt": "2026-11-06T09:15:02.120Z",
  "updatedAt": "2026-11-06T09:15:09.874Z"
}
```

Exemple en échec :

```json
{
  "id": "<id>",
  "url": "https://exemple.fr/",
  "state": "error",
  "step": "queued",
  "createdAt": "2026-11-06T09:15:02.120Z",
  "updatedAt": "2026-11-06T09:16:03.410Z",
  "error": {
    "code": "unreachable",
    "message": "La page ne s’est pas chargée dans le délai de 60 secondes."
  }
}
```

Quand `state` vaut `done`, le champ `report` contient le rapport complet (voir les schémas plus bas).

Un rapport expire 30 jours après sa création : il répond ensuite `404 not_found`.

### `DELETE /api/analyses/:id`

Demande l'annulation d'une analyse. Répond toujours `202 Accepted` avec l'`AnalysisStatus` courant dans le corps :

- analyse `pending` ou `running` : l'état est enregistré à `cancelled` et renvoyé. L'exécution s'arrête dès qu'elle s'en aperçoit (voir [`architecture.md`](architecture.md#parcours-dune-analyse)) ;
- analyse déjà terminée (`done`, `error` ou `cancelled`) : rien ne change, l'état existant est renvoyé tel quel. Un rapport terminé n'est donc pas supprimé par `DELETE` ;
- analyse inconnue ou expirée : `404 not_found`.

```sh
curl -sS -X DELETE https://balise-tau.vercel.app/api/analyses/<id>
```

### `GET /api/analyses/:id/screenshot`

Renvoie la capture d'écran de la zone visible de la page (JPEG, 1280 × 800 pixels, qualité 60), avec `Cache-Control: private, max-age=86400`. Disponible seulement si `report.hasScreenshot` vaut `true` ; sinon, `404 not_found`.

```sh
curl -sS -o capture.jpg https://balise-tau.vercel.app/api/analyses/<id>/screenshot
```

## Erreurs

Toute erreur a la même forme, avec un message en français destiné à l'utilisateur :

```json
{
  "error": {
    "code": "forbidden_target",
    "message": "Cette adresse désigne un réseau privé, local ou réservé : l'analyse n'est pas autorisée."
  }
}
```

### Erreurs renvoyées directement par l'API

| Statut HTTP | Code                     | Quand                                                                                                                              |
| ----------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `400`       | `invalid_url`            | Corps absent, non JSON, de plus de 8 Kio ou sans champ `url` ; URL vide, trop longue ou non analysable                             |
| `403`       | `forbidden_origin`       | Requête envoyée depuis un autre site (`Sec-Fetch-Site: cross-site`)                                                                |
| `415`       | `unsupported_media_type` | `Content-Type` absent ou différent de `application/json`                                                                           |
| `422`       | `forbidden_target`       | Schéma autre que `http`/`https`, port autre que 80/443, identifiants dans l'URL, nom ou adresse non publics                        |
| `422`       | `dns_failure`            | Le nom de domaine ne se résout pas                                                                                                 |
| `429`       | `rate_limited`           | Plus de 10 analyses dans l'heure glissante pour ce client, ou plus de 100 pour tout le service ; en-tête `Retry-After` en secondes |
| `404`       | `not_found`              | Analyse ou capture inconnue, expirée (30 jours), identifiant mal formé, ou chemin d'API inexistant                                 |
| `405`       | `method_not_allowed`     | Méthode non prévue ; l'en-tête `Allow` liste les méthodes acceptées (`POST`, `GET, DELETE` ou `GET`)                               |
| `500`       | `internal`               | Erreur inattendue, ou configuration incomplète sur Vercel (variables Upstash ou `RATE_LIMIT_SALT` absentes)                        |

`Retry-After` indique le nombre de secondes (au moins 1) avant qu'une nouvelle analyse soit acceptée ; le front l'utilise pour afficher le délai d'attente.

Les réponses JSON portent `Cache-Control: no-store` et `X-Content-Type-Options: nosniff`.

### Erreurs d'une analyse

Une fois la réponse `202` envoyée, une erreur ne peut plus changer le statut HTTP. Elle est enregistrée dans l'analyse : `GET /api/analyses/:id` répond `200` avec `state: "error"` et le champ `error`.

| Code               | Signification                                                                                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `forbidden_target` | Une requête de navigation visait une adresse non publique (par exemple une redirection vers un réseau privé)                                        |
| `dns_failure`      | Le nom de domaine n'a pas pu être résolu                                                                                                            |
| `unreachable`      | Erreur réseau, délai dépassé (60 s de chargement, 20 s par requête, 240 s pour l'analyse entière) ou statut HTTP ≥ 400 sur le document principal    |
| `too_large`        | Plus de 300 requêtes, plus de 15 Mo au total ou une ressource de plus de 5 Mo                                                                       |
| `not_html`         | Le document principal n'est pas `text/html` ni `application/xhtml+xml`                                                                              |
| `internal`         | Erreur inattendue (lancement de Chromium, exécution d'axe-core…), ou analyse restée en cours plus de 300 s sans mise à jour (traitement interrompu) |

Liste complète des codes (`AnalysisErrorCode`) : `invalid_url`, `forbidden_target`, `dns_failure`, `rate_limited`, `unreachable`, `too_large`, `not_html`, `not_found`, `internal`. Les messages par défaut sont dans `packages/analyzer/src/errors.ts`. S'y ajoutent `method_not_allowed`, `unsupported_media_type` et `forbidden_origin`, propres à la couche HTTP (`server/handlers.ts`) et jamais stockés dans une analyse.

## Schémas

Les types ci-dessous reprennent `packages/analyzer/src/types.ts`, qui fait foi.

### `AnalysisStatus` (réponse de `GET /api/analyses/:id`)

| Champ       | Type                                                         | Description                     |
| ----------- | ------------------------------------------------------------ | ------------------------------- |
| `id`        | `string`                                                     | Identifiant de l'analyse        |
| `url`       | `string`                                                     | URL soumise                     |
| `state`     | `"pending" \| "running" \| "done" \| "error" \| "cancelled"` | État                            |
| `step`      | `AnalysisStep` (facultatif)                                  | Dernière étape terminée         |
| `createdAt` | `string` (ISO 8601)                                          | Création                        |
| `updatedAt` | `string` (ISO 8601)                                          | Dernière mise à jour            |
| `error`     | `{ code: AnalysisErrorCode; message: string }` (facultatif)  | Présent si `state` vaut `error` |
| `report`    | `AnalysisReport` (facultatif)                                | Présent si `state` vaut `done`  |

`AnalysisStep`, dans l'ordre : `validated` (adresse vérifiée), `queued` (prise en charge), `loading` (chargement de la page), `testing` (tests RGAA), `scoring` (calcul des scores).

### `AnalysisReport`

| Champ           | Type                                                | Description                                                           |
| --------------- | --------------------------------------------------- | --------------------------------------------------------------------- |
| `schemaVersion` | `1`                                                 | Version du format du rapport                                          |
| `id`            | `string`                                            | Identifiant de l'analyse                                              |
| `url`           | `string`                                            | URL soumise                                                           |
| `finalUrl`      | `string`                                            | URL après redirections (**non fiable**)                               |
| `analyzedAt`    | `string` (ISO 8601)                                 | Fin de l'analyse                                                      |
| `durationMs`    | `number`                                            | Durée de l'analyse                                                    |
| `reference`     | `{ name: string; version: string }`                 | Référentiel utilisé, par exemple RGAA `4.1.2`                         |
| `engine`        | `{ balise: string; axe: string; chromium: string }` | Versions du moteur, d'axe-core et de Chromium                         |
| `page`          | `{ title: string; lang: string \| null }`           | Titre (1 000 caractères au plus) et attribut `lang` (**non fiables**) |
| `scores`        | `{ global: ScoreValue; themes: ThemeScore[] }`      | Scores indicatifs                                                     |
| `criteria`      | `CriterionResult[]`                                 | Un résultat par critère du référentiel (106 pour le RGAA 4.1.2)       |
| `hasScreenshot` | `boolean`                                           | Capture disponible sur `/api/analyses/:id/screenshot`                 |

### `ScoreValue` et `ThemeScore`

| Champ          | Type                                | Description                                                             |
| -------------- | ----------------------------------- | ----------------------------------------------------------------------- |
| `score`        | `number \| null`                    | Entier de 0 à 100, ou `null` si « Non évaluable » (aucun critère testé) |
| `tier`         | `"good" \| "warn" \| "bad" \| null` | Palier : 90-100, 50-89, 0-49 ; `null` si non évaluable                  |
| `tested`       | `number`                            | Critères testés (conformes + non conformes)                             |
| `total`        | `number`                            | Critères du périmètre (thématique ou référentiel entier)                |
| `conformes`    | `number`                            | Critères « Conforme (auto) »                                            |
| `nonConformes` | `number`                            | Critères « Non conforme (auto) »                                        |
| `theme`        | `number` (`ThemeScore` seulement)   | Numéro de la thématique (1 à 13)                                        |
| `title`        | `string` (`ThemeScore` seulement)   | Intitulé officiel de la thématique                                      |

Méthode de calcul : [`scoring.md`](scoring.md).

### `CriterionResult`

| Champ      | Type                                                               | Description                                                                   |
| ---------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `id`       | `string`                                                           | Numéro du critère, par exemple `"1.1"`                                        |
| `theme`    | `number`                                                           | Numéro de la thématique                                                       |
| `title`    | `string`                                                           | Intitulé officiel                                                             |
| `url`      | `string`                                                           | Lien vers le critère sur accessibilite.numerique.gouv.fr                      |
| `status`   | `"conforme" \| "non-conforme" \| "a-verifier" \| "non-applicable"` | Conforme (auto), Non conforme (auto), À vérifier manuellement, Non applicable |
| `rules`    | `string[]`                                                         | Règles évaluées pour ce critère                                               |
| `findings` | `Finding[]`                                                        | Erreurs détectées (seulement si `status` vaut `non-conforme`)                 |

### `Finding` et `FindingNode`

| Champ         | Type                  | Description                                                                                                     |
| ------------- | --------------------- | --------------------------------------------------------------------------------------------------------------- |
| `rule`        | `string`              | Identifiant de la règle (`image-alt`, `balise-skip-link`…)                                                      |
| `engine`      | `"axe" \| "balise"`   | axe-core ou contrôle maison                                                                                     |
| `explanation` | `string`              | Le problème, en français                                                                                        |
| `fix`         | `string`              | Piste de correction, en français                                                                                |
| `helpUrl`     | `string` (facultatif) | Documentation de la règle (axe-core)                                                                            |
| `count`       | `number`              | Nombre total d'éléments concernés                                                                               |
| `nodes`       | `FindingNode[]`       | 20 éléments au plus : `selector` (sélecteur CSS) et `html` (extrait de 500 caractères au plus), **non fiables** |

### Exemple de rapport (abrégé)

```json
{
  "schemaVersion": 1,
  "id": "<id>",
  "url": "https://exemple.fr/",
  "finalUrl": "https://www.exemple.fr/",
  "analyzedAt": "2026-11-06T09:15:31.002Z",
  "durationMs": 28882,
  "reference": { "name": "RGAA 4.1.2", "version": "4.1.2" },
  "engine": { "balise": "<version>", "axe": "4.14.0", "chromium": "<version>" },
  "page": { "title": "Accueil – Exemple", "lang": "fr" },
  "scores": {
    "global": {
      "score": 60,
      "tier": "warn",
      "tested": 10,
      "total": 106,
      "conformes": 6,
      "nonConformes": 4
    },
    "themes": [
      {
        "theme": 1,
        "title": "Images",
        "score": 75,
        "tier": "warn",
        "tested": 4,
        "total": 9,
        "conformes": 3,
        "nonConformes": 1
      }
    ]
  },
  "criteria": [
    {
      "id": "1.1",
      "theme": 1,
      "title": "Chaque image porteuse d’information a-t-elle une alternative textuelle ?",
      "url": "https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/#1.1",
      "status": "non-conforme",
      "rules": ["image-alt"],
      "findings": [
        {
          "rule": "image-alt",
          "engine": "axe",
          "explanation": "Cette image n'a pas d'alternative textuelle : un lecteur d'écran ne peut pas la décrire.",
          "fix": "[piste de correction issue du référentiel]",
          "helpUrl": "https://dequeuniversity.com/rules/axe/4.14/image-alt",
          "count": 1,
          "nodes": [{ "selector": "main > img", "html": "<img src=\"logo.png\">" }]
        }
      ]
    }
  ],
  "hasScreenshot": true
}
```

Les valeurs de cet exemple sont illustratives : les intitulés, explications et pistes de correction réels proviennent de `packages/rgaa-mapping/src/data/rgaa-4.1.2.json`.

## Limites d'usage

- 10 analyses par heure et par client, en fenêtre glissante (`@upstash/ratelimit`, `slidingWindow(10, '1 h')`, préfixe `balise:ratelimit`). Le client est identifié par `HMAC-SHA-256(RATE_LIMIT_SALT, ip)`, l'IP venant de `x-real-ip` (posé par Vercel), sinon du premier élément de `x-forwarded-for`.
- Une analyse dure au plus 240 s, sous la limite de 300 s de la fonction Vercel ; le chargement de la page est plafonné à 60 s.
- Pages publiques uniquement : pas d'authentification, de cookies fournis par l'utilisateur ni d'interaction.

## Mode de test de bout en bout

Avec `BALISE_E2E_FAKE_ANALYZER=1`, l'API remplace le moteur par un moteur simulé (`server/fake-analyzer.ts`) : aucun navigateur, aucun accès réseau, résolution DNS factice vers une adresse publique jamais contactée, rapport plausible en moins d'une seconde. Une URL qui contient `unreachable` produit l'erreur `unreachable`.

- Ce mode n'est actif que si `NODE_ENV` n'est pas `production` **et** hors de Vercel (`VERCEL` absent) : il ne peut pas s'activer en production.
- Dans ce mode seulement, l'en-tête `x-balise-e2e-client` est ajouté à la clé de limitation de débit, pour que chaque test dispose de son propre quota. Hors de ce mode, il est ignoré.
