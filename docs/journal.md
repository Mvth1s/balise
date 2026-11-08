# Journal d'avancement

## Étape 1 — Vérifications, agents, squelette (2026-11-05)

- Comptes vérifiés : GitHub `Mvth1s`, Vercel `mvth1s` (équipe `mvth1s-projects`, offre Hobby).
- Faits Vercel vérifiés dans la documentation officielle (2026-11-05) : région Paris `cdg1` ; Hobby : `maxDuration` 300 s (défaut et maximum), 2 Go de mémoire ; taille de fonction 250 Mo non compressés ; Node.js 26.x (défaut), 24.x, 22.x ; pnpm 6 à 12 pris en charge.
- Choix de versions : Node 24.x (LTS, compatible @sparticuz/chromium) ; TypeScript 6.0.3 (typescript-eslint 8.72 exige < 6.1) ; playwright-core 1.63.0 car il embarque Chromium 153, comme @sparticuz/chromium 153.0.0 ; pnpm 12.15.0 (12.17.0 a moins de 14 jours).
- Huit sous-agents créés dans `.claude/agents/`, `CLAUDE.md` rédigé, monorepo pnpm initialisé.

## Étapes 2 et 3 — Mapping RGAA, moteur, API, sécurité (2026-11-06)

- Référentiel RGAA 4.1.2 (106 critères, 13 thématiques) construit à partir des sources officielles de la DINUM ; chaque règle axe ou maison pointe vers des critères existants (testé).
- Moteur : filtre SSRF (IPv4, IPv6, formes numériques, NAT64, métadonnées cloud), une seule résolution DNS par connexion, redirections jamais transmises au navigateur et revalidées, interception Playwright de toutes les requêtes, proxy mort en filet de sécurité, plafonds (60 s, 300 requêtes, 15 Mo cumulés).
- API Vercel (`waitUntil`), stockage Upstash (TTL 30 jours) avec repli mémoire, limitation de débit (10/h par client, 100/h au total, IP hachée par HMAC, préfixe /64 en IPv6).
- Correctif de déploiement : les imports `.ts` relatifs n'étaient pas réécrits par Vercel ; `rewriteRelativeImportExtensions` dans `tsconfig.json`.
- Revue de sécurité (`docs/securite-revue.md`) : aucun constat critique ; options dangereuses de @sparticuz/chromium retirées, analyses interruptibles, GET/HEAD seulement, contrôle `Content-Type`/`Sec-Fetch-Site`, en-têtes renforcés. Risque résiduel documenté : Chromium partage la fonction qui détient les secrets Redis.

## Étapes 4 et 5 — Front, pages légales, démo (2026-11-06)

- Front Vue 3 pré-rendu (15 pages) : accueil, analyse en cours, rapport, exemples avant/après, démo, pages légales, bandeau de consentement maison (affiché seulement si `VITE_GA_MEASUREMENT_ID` est défini).
- Pages légales relues : adresse de Vercel vérifiée, régime de l'éditeur non professionnel (LCEN art. 1-1 II), RGPD art. 13, durée réelle de conservation de l'empreinte d'IP (2 heures au plus).
- Libellé « Accessibilité : non conforme » (statut DINUM en l'absence d'audit) ; la déclaration précise qu'aucun audit n'a encore été réalisé. À revoir après l'audit manuel.
- `pnpm demo:build` génère les rapports de démo avec le vrai moteur ; ils servent de test de non-régression. `/demo/avant` : 14 critères non conformes sur 12 thématiques ; la thématique 4 ne sort qu'en « à vérifier » (axe classe une vidéo sans sous-titres en « incomplete »). `/demo/apres` : aucun.

## Étape 6 — Accessibilité de Balise (2026-11-06)

- Suite e2e Playwright : 101 tests (axe zéro violation sur chaque page et état, clavier, 320 px, zoom, mouvement réduit, consentement, erreurs).
- Audit automatique (`docs/accessibilite/audit-automatique.md`) et grille d'audit manuel des 106 critères (`docs/accessibilite/grille-audit-manuel.md`).

## Étape 7 — CI, Vercel, Upstash (2026-11-06)

- Dépôt public `Mvth1s/balise`, topics, protection de `main` (CI obligatoire, historique linéaire).
- Projet Vercel `balise` relié au dépôt ; Upstash Redis `balise-redis` (plan Free) via la marketplace ; `RATE_LIMIT_SALT` défini en production et preview.
- Analyses réelles vérifiées sur la préversion (service-public.fr, wikipedia.org, gov.uk). La couverture automatique est faible (3 à 5 critères sur 106) : le mapping ne déclare un critère conforme que si les tests le couvrent entièrement.
- Releases : le journal des versions est porté par les releases GitHub (pas de commit sur `main`, protégée).

## Étapes 8 et 9 — Production et première release (2026-11-07)

- Production : https://balise-tau.vercel.app (le domaine `balise.vercel.app` appartient à un autre projet Vercel). `VITE_SITE_URL` défini, `sitemap.xml` généré.
- Test de fumée en production : 15 routes (dont 404), en-têtes de sécurité présents, analyse réelle de https://www.numerique.gouv.fr/ terminée avec capture, adresse de métadonnées refusée (422), corps non JSON refusé (415). Suites e2e axe, pages légales et affichage contre la production : 56 tests réussis (les deux tests qui supposent le faux moteur rapide sont propres à l'environnement local).
- Release v1.0.0 publiée par semantic-release (preset `conventionalcommits` 9.3.1, compatible avec le générateur de notes embarqué).

## Étape 8 — Couverture, animations, UX, isolation (2026-11-07)

- Statut d'accessibilité : « non conforme », avec la mention qu'aucun audit n'a encore été réalisé (#8).
- Écran d'analyse : 600 ms minimum par étape, jauge du logo en boucle avec bouton pause (#9).
- Couverture automatique en trois temps, critères évalués (conforme, non conforme, non applicable) sur `/demo/avant` et quatre sites publics :

  | Page               | Départ | Détection d'erreurs (#10) | Non applicable auto (#15) | Interactions (#17) |
  | ------------------ | ------ | ------------------------- | ------------------------- | ------------------ |
  | /demo/avant        | 16     | 30                        | 40                        | 42                 |
  | service-public.fr  | 3      | 6                         | 34                        | 36                 |
  | fr.wikipedia.org   | 6      | 11                        | 29                        | 30                 |
  | legifrance.gouv.fr | 5      | 6                         | 26                        | 28                 |
  | lemonde.fr         | 10     | 15                        | 44                        | 45                 |

- Refonte UX : accueil épuré, rapport en trois niveaux (#13). Balise de validation Search Console (#14) ; consentement GA4 vérifié en production (aucune requête Google avant acceptation).
- En attente : worker Chromium isolé (#18, projet Vercel `balise-worker` à créer) et jugement par IA Mistral (#19, empilée sur #18, clé à fournir). L'objectif de 86 critères évalués sur 106 n'est pas atteint par les seuls tests automatiques ; l'IA ajoute au plus 11 critères.

## Étape 9 — Retour au design initial, popup de consentement, worker isolé, IA (2026-11-08)

- Refonte UX annulée par `git revert` (#21) : accueil et rapport d'avant #13 ; #14, #15 et #17 conservés (aucun conflit).
- Consentement : popup modale `<dialog>` (focus initial sur le texte, focus enfermé, Échap = refus, retour du focus), annonce invisible `role="status"` à la place du message de confirmation (#22). Vérifié en production : aucune requête Google avant choix, `gtag.js` chargé après acceptation, zéro violation axe.
- Worker Chromium isolé (#23, remplace #18) : projet Vercel `balise-worker` (racine `worker/`, région `cdg1`, relié au dépôt, sans Upstash), variables `BALISE_TOKEN_PUBLIC_KEY` et `BALISE_API_ORIGIN` seulement ; `balise` reçoit `BALISE_TOKEN_PRIVATE_KEY` et `BALISE_WORKER_URL`. Build du worker : 41 s, fonction `api/run` de 136 Mo en `cdg1`. Analyse réelle de service-public.fr en production via le worker : terminée en 15 s, capture servie.
- Jugement par IA Mistral (#24, remplace #19), fusionné. Évaluation `scripts/ai-eval.ts` impossible : l'espace La Plateforme répond 429 avec une limite de 0 requête par minute (plan gratuit non activé). Couche IA donc inactive en pratique.
- Critères évalués (sans IA) :

  | Page               | Évalués | Auto (C / NC) | IA  | Non applicable | À vérifier |
  | ------------------ | ------- | ------------- | --- | -------------- | ---------- |
  | /demo/avant        | 41      | 31 (5 / 26)   | 0   | 10             | 65         |
  | /demo/apres        | 17      | 6 (6 / 0)     | 0   | 11             | 89         |
  | service-public.fr  | 36      | 8 (6 / 2)     | 0   | 28             | 70         |
  | fr.wikipedia.org   | 30      | 12 (4 / 8)    | 0   | 18             | 76         |
  | legifrance.gouv.fr | 28      | 8 (6 / 2)     | 0   | 20             | 78         |
  | lemonde.fr         | 45      | 16 (4 / 12)   | 0   | 29             | 61         |
