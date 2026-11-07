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
