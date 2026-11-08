# Mission : construire et déployer Balise de A à Z

Tu es le lead technique du projet Balise. Tu dois livrer, sans intervention humaine sauf blocage réel, un produit complet : code front et back, tests, documentation, pipeline CI/CD, dépôt GitHub configuré et application déployée en production sur Vercel.

Travaille en autonomie. Ne me pose pas de question pour des choix techniques que ce document te permet de trancher. Arrête-toi uniquement dans les cas listés à la section « Quand t'arrêter ».

## 0. Contexte et fichiers fournis

Balise est un outil web de pré-diagnostic d'accessibilité RGAA : l'utilisateur saisit l'URL d'une page publique, Balise l'analyse dans un navigateur headless, mappe les résultats sur les critères RGAA 4.1.2 et affiche un score indicatif par thématique et un score global, façon Lighthouse, avec la liste des erreurs, des pistes de correction et des critères à vérifier manuellement.

Le dossier courant contient :

- `docs/charte/` : charte graphique (README.md = livret de marque, tokens.json = couleurs, typo, espacements, rayons ; logos/ = logos SVG). Applique-la strictement.
- `docs/maquette/` : maquettes de référence de 6 écrans (voir leur README). Reproduis leur structure, leurs textes et leur accessibilité, en les améliorant si besoin.
- Ce fichier `KICKOFF.md` : la spécification fait foi. Déplace-le dans `docs/specs/kickoff.md` au premier commit.

Auteur : n'utilise JAMAIS de nom réel. L'éditeur affiché partout (pied de page, mentions légales, package.json, LICENSE, README) est le pseudo `Mvth1s`. Contact du projet : `mag.d3v+balise@pm.me`. Compte GitHub : `Mvth1s`.

## 1. Vérifications préalables (avant toute écriture)

1. `gh auth status` : doit être connecté au compte Mvth1s.
2. `vercel whoami` : doit être connecté.
3. `node -v` (Node LTS actuel requis), `pnpm -v` (installe pnpm via corepack si absent), `git config user.name` et `git config user.email` (ne les modifie pas).
4. Si l'un des deux comptes n'est pas connecté : arrête-toi et donne-moi la commande exacte à lancer (`gh auth login` ou `vercel login`), puis reprends quand je te dis que c'est fait.

## 2. Agents du projet

Crée d'abord ces sous-agents dans `.claude/agents/` (fichiers Markdown avec frontmatter YAML : name, description, tools, model), versionnés dans le dépôt. Délègue-leur le travail et fais-les tourner en parallèle quand les tâches sont indépendantes. Tu restes l'orchestrateur : tu découpes, tu délègues, tu intègres, tu valides.

| Agent | Rôle | Outils |
| --- | --- | --- |
| `frontend-dev` | Interface Vue, composants, animations, application de la charte, pages légales | lecture, écriture, bash |
| `backend-dev` | Fonctions serverless, moteur d'analyse, stockage, sécurité d'exécution | lecture, écriture, bash |
| `rgaa-mapper` | Construit et maintient la correspondance règles de test vers critères RGAA, à partir du référentiel officiel uniquement | lecture, écriture, bash, web |
| `a11y-auditor` | Audite l'interface de Balise elle-même : axe, clavier, focus, zoom 200 %, 320 px, reduced-motion, lecteurs d'écran simulés, contrastes. Rend un rapport, ne corrige pas lui-même | lecture, bash |
| `security-reviewer` | Revue SSRF, en-têtes, CSP, dépendances, secrets, injection | lecture, bash |
| `test-engineer` | Tests unitaires, intégration, e2e, non-régression, couverture | lecture, écriture, bash |
| `devops` | Dépôt GitHub, CI GitHub Actions, Vercel, variables d'environnement, releases | lecture, écriture, bash |
| `docs-writer` | README, docs/, ADR, CONTRIBUTING, contenus des pages légales en français | lecture, écriture, web |

Écris aussi un `CLAUDE.md` à la racine : résumé du projet, stack, commandes, conventions, règles non négociables (accessibilité, pseudo Mvth1s, sécurité), pour les futures sessions.

## 3. Stack imposée

Le cahier des charges initial prévoyait FastAPI, Redis et un worker sur un VPS OVHcloud. Pour un déploiement 100 % Vercel, la stack est adaptée ainsi. Documente ce choix dans une ADR (`docs/adr/0001-hebergement-vercel.md`) avec le chemin de migration vers un VPS OVHcloud (worker conteneurisé) si les limites serverless deviennent bloquantes.

- Langage : TypeScript strict partout.
- Gestionnaire : pnpm, monorepo simple (`apps/web`, `packages/analyzer`, `packages/rgaa-mapping`, `api/` pour les fonctions Vercel) ou structure plus simple si plus adaptée à Vercel. Justifie dans une ADR.
- Front : Vue 3 + Vite + vue-router, Composition API. Pré-rendu des pages statiques (accueil, pages légales, démo) pour le SEO et la rapidité.
- API : Vercel Functions, runtime Node.js, région Paris (vérifie l'identifiant de région dans la doc Vercel, a priori `cdg1`), `maxDuration` adapté (l'offre Hobby autorise jusqu'à 300 s selon la doc consultée en novembre 2026 ; vérifie).
- Analyse : `playwright-core` + `@sparticuz/chromium` (Chromium compatible serverless) + `@axe-core/playwright`. Vérifie la compatibilité des versions entre elles et avec la limite de taille des fonctions Vercel (250 Mo non compressés selon la doc consultée).
- Asynchrone : `POST /api/analyses` valide l'URL, crée l'analyse, répond 202 avec un id, puis poursuit le travail avec `waitUntil` (`@vercel/functions`). Le front interroge `GET /api/analyses/:id` pour l'avancement et le résultat.
- Stockage : Upstash Redis via la marketplace Vercel, région Europe. Rapports stockés avec TTL de 30 jours (purge automatique), limitation de débit avec `@upstash/ratelimit`. Abstrais le stockage derrière une interface pour pouvoir changer de fournisseur.
- Tests : Vitest (unitaire, intégration), Playwright Test (e2e), `@axe-core/playwright` sur les pages de Balise.
- Qualité : ESLint, Prettier, `vue-tsc`, Commitlint (Conventional Commits), Husky, lint-staged, semantic-release.
- Versions : récupère les versions stables actuelles avec `npm view <paquet> version` au lieu de ta mémoire, et n'installe aucune version publiée depuis moins de 14 jours. Épingle les versions exactes.

## 4. Fonctionnalités à livrer

### Parcours

1. Accueil : champ URL avec étiquette, validation en direct, bouton « Analyser la page », lien « Essayer avec une page d'exemple ».
2. Analyse en cours : 5 étapes (adresse vérifiée, prise en charge, chargement de la page, tests RGAA, calcul des scores), barre de progression accessible (aria-valuenow), annonces aria-live, bouton Annuler.
3. Rapport à URL unique partageable, conservé 30 jours.

### Moteur d'analyse

- Chargement de la page, exécution du JavaScript, attente de stabilisation, capture d'écran.
- axe-core sur la page rendue, plus des contrôles maison pour des critères mal couverts (lien d'évitement, hiérarchie des titres, langue de la page, titre de page).
- Correspondance vers RGAA 4.1.2 via un fichier JSON versionné (`rgaa-4.1.2.json`) : règle de test vers critère(s), thématique, statut. L'agent `rgaa-mapper` construit ce fichier à partir du référentiel officiel publié par la DINUM (site accessibilite.numerique.gouv.fr et dépôt officiel s'il existe) : numéros, intitulés et thématiques exacts, aucune invention. Chaque entrée cite sa source. Prévois un futur `rgaa-5.json`.
- Statuts par critère : Conforme (auto), Non conforme (auto), À vérifier manuellement, Non applicable.

### Scores (tous indicatifs)

- Score de thématique = 100 × C / (C + NC), C et NC = critères conformes et non conformes détectés automatiquement.
- Thématique sans critère testé : « Non évaluable », jamais 100.
- Score global = moyenne pondérée par le nombre de critères testés par thématique. Pondération dans un fichier de configuration.
- Paliers : 90-100 vert « Peu d'erreurs », 50-89 orange « À corriger », 0-49 rouge « Nombreuses erreurs ». Couleur toujours accompagnée d'une icône et d'un libellé.
- Couverture affichée sous chaque score (« 4 critères testés ») et au global (« 32 critères testés automatiquement sur 106 »).
- Bandeau permanent sur le rapport : « Scores indicatifs. Ils ne constituent pas un taux de conformité RGAA et ne doivent pas être repris dans une déclaration d'accessibilité. »

### Rapport

- Jauge globale et 13 jauges de thématique (arc ouvert en bas, comme le logo), nom accessible complet sur chaque jauge.
- Filtres par statut et par thématique.
- Pour chaque critère non conforme : explication en français, éléments concernés (sélecteur et extrait HTML échappé), piste de correction, lien vers le critère officiel.
- Section « À vérifier manuellement » avec checklist interactive (état gardé dans le navigateur).
- Copier le lien, export JSON.

### Pages de démonstration

- `/demo/avant` : page fictive avec des erreurs volontaires (au moins une par thématique testable), bandeau d'avertissement accessible, `noindex`.
- `/demo/apres` : la même page corrigée.
- Rapports pré-calculés générés par un script (`pnpm demo:build`) et versionnés ; le bouton « Essayer avec une page d'exemple » les affiche instantanément. Vue comparative avant et après. Ces rapports servent aussi de tests de non-régression du moteur.

### Animations

Nombreuses mais utiles : coche qui se dessine à la validation de l'URL, transition vers l'écran d'analyse (View Transitions API), étapes qui se cochent, jauges qui se remplissent avec compteur, cartes en cascade (40 ms), accordéons, réorganisation FLIP des filtres, coche de confirmation à la copie, fondu de thème 200 ms.

Règles : 150 à 400 ms, ease-out, uniquement transform et opacity ; `prefers-reduced-motion: reduce` supprime les déplacements et affiche les jauges directement ; interrupteur « Animations » mémorisé ; tout mouvement de plus de 5 s peut être mis en pause ; aucun clignotement ; jamais d'information portée par l'animation seule. CSS et Web Animations API, pas de bibliothèque d'animation lourde.

### Pied de page et pages légales (identique sur toutes les pages)

Navigation nommée « Liens de pied de page » avec : Mentions légales, Politique de confidentialité, Gestion des cookies, Accessibilité : non conforme (lien vers la déclaration), Conditions d'utilisation, Plan du site, Contact, Code source. Ligne : « Balise, par Mvth1s. Scores indicatifs, sans valeur de certification RGAA. »

Rédige le contenu complet de chaque page en français (agent `docs-writer`) :

- Mentions légales (LCEN) : éditeur Mvth1s, contact, hébergeur Vercel Inc. avec ses coordonnées exactes relevées sur le site officiel de Vercel. Ajoute un commentaire TODO visible dans le code (pas sur la page) rappelant de vérifier les obligations d'identification d'un éditeur non professionnel.
- Politique de confidentialité (RGPD art. 13) : données traitées (URL analysée, rapport, capture, IP hachée pour la limitation de débit 24 h, données GA4 après consentement), finalités, bases légales, durées, destinataires (Vercel, Upstash, Google), transferts hors UE et leur encadrement, droits, réclamation CNIL.
- Gestion des cookies : stockage nécessaire (préférences locales), mesure d'audience GA4 avec interrupteur, tableau des cookies, enregistrement du choix.
- Déclaration d'accessibilité : modèle conforme, état « non conforme » tant que l'audit manuel n'est pas fait, page démo « avant » exclue et justifiée.
- Conditions d'utilisation, plan du site, contact.

### Mesure d'audience GA4 et consentement

- Identifiant dans la variable `VITE_GA_MEASUREMENT_ID`. Si elle est absente, aucun code GA4 n'est chargé et la popup de consentement ne s'affiche pas.
- Popup modale maison (pas de bibliothèque tierce ; remplace le bandeau non bloquant depuis le 2026-11-07, voir ADR 0004) : « Tout refuser » et « Tout accepter » de même apparence, lien « Personnaliser mes choix », aucune case pré-cochée, choix conservé 6 mois, retrait via « Gestion des cookies ». Aucun script Google avant consentement (Consent Mode en mode basique).
- Configuration GA4 : signaux Google et personnalisation publicitaire désactivés, durée des cookies limitée à 13 mois maximum.
- La popup respecte le RGAA (clavier, focus, contraste, zoom, lecteurs d'écran).

## 5. Exigences non fonctionnelles non négociables

### Sécurité (revue obligatoire par `security-reviewer`)

- SSRF : n'accepte que http et https ; résous le DNS côté serveur et refuse les adresses privées, réservées, de bouclage, link-local et de métadonnées cloud (IPv4 et IPv6) ; revérifie chaque redirection et chaque requête de navigation via l'interception de requêtes de Playwright ; protège contre le DNS rebinding.
- Limites : 60 s de chargement, plafond de taille de page et de nombre de requêtes, téléchargements désactivés.
- Limitation de débit : 10 analyses par heure et par IP (IP hachée, expirée après 24 h).
- En-têtes : CSP stricte (autorise GA4 seulement après consentement), HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy. Aucun secret dans le dépôt.
- Échappe tout contenu issu des pages analysées avant affichage.

### Accessibilité de Balise elle-même

- Objectif : 100 % des critères RGAA applicables conformes sur toutes les pages.
- Tests automatiques axe sur chaque page et chaque état en e2e : zéro violation tolérée, la CI échoue sinon.
- Tests e2e clavier (parcours complet sans souris), zoom 200 %, largeur 320 px, `prefers-reduced-motion`.
- L'agent `a11y-auditor` produit `docs/accessibilite/audit-automatique.md` et une grille `docs/accessibilite/grille-audit-manuel.md` (tous les critères RGAA, à remplir à la main), car l'audit manuel complet reste à faire par un humain avant ouverture au public.

### Charte

- Polices auto-hébergées (woff2 servis par Balise, aucune requête à Google Fonts) : Atkinson Hyperlegible Next et JetBrains Mono, toutes deux sous OFL. Inclure les fichiers de licence.
- Couleurs, espacements, rayons depuis `docs/charte/tokens.json` transformés en variables CSS, thèmes clair et sombre (préférence système plus bascule manuelle).
- Vouvoiement, jamais de promesse de conformité.

### Performance

Lighthouse (performance, bonnes pratiques, SEO) à 90 minimum sur l'accueil, mesuré en CI avec Lighthouse CI.

## 6. Tests

- Unitaire : validation d'URL et filtre SSRF (cas limites IPv4, IPv6, redirections), calcul des scores, mapping RGAA (chaque règle mappée vers un critère existant du référentiel), utilitaires.
- Intégration : moteur d'analyse sur les pages de démo servies localement, comparaison avec les rapports attendus.
- E2E Playwright : parcours complet, démo, filtres, copie du lien, popup cookies (refus, Échap, acceptation, retrait), pages légales, erreurs (URL invalide, IP privée refusée, limite atteinte, page inaccessible).
- Couverture minimale 80 % sur `packages/analyzer` et le mapping.

## 7. Dépôt GitHub et pipeline

1. `git init`, branche `main`, `.gitignore`, `.editorconfig`, `.nvmrc`, licence MIT au nom de Mvth1s.
2. `gh repo create Mvth1s/balise --public` avec la description « Pré-diagnostic d'accessibilité RGAA à partir d'une URL : score indicatif par thématique, erreurs détectées et critères à vérifier manuellement. », topics `accessibility`, `a11y`, `rgaa`, `wcag`, `axe-core`, `vue`, `typescript`, `vercel`, puis l'URL de production comme homepage une fois déployée.
3. Fichiers GitHub : README (badges CI, captures, démarrage local, architecture, limites, licence), CONTRIBUTING, CODE_OF_CONDUCT, SECURITY (contact mag.d3v+balise@pm.me), modèles d'issues et de PR, Dependabot (npm et GitHub Actions, hebdomadaire).
4. GitHub Actions :
   - `ci.yml` sur PR et push : installation avec cache, lint, typecheck, tests unitaires et intégration avec couverture, build, e2e Playwright avec axe, Lighthouse CI.
   - `codeql.yml` et dependency review.
   - `release.yml` : semantic-release sur `main` (changelog, tag, release GitHub).
5. Protection de `main` via `gh api` : CI verte obligatoire, historique linéaire. Pas de revue obligatoire (projet solo).
6. Vercel : `vercel link`, connexion du dépôt Git (`vercel git connect`) pour les déploiements de prévisualisation sur PR et de production sur `main`, variables d'environnement via `vercel env add`, région des fonctions, en-têtes de sécurité dans `vercel.json`.
7. Upstash Redis : provisionne-le via la marketplace Vercel en CLI si c'est possible. Si une action dans le tableau de bord est indispensable, arrête-toi et donne-moi les clics exacts.
8. Travaille par branches de fonctionnalité et PR (`gh pr create`), fusionne quand la CI est verte. Commits en anglais au format Conventional Commits, petits et fréquents.

## 8. Documentation (`docs/`)

- `architecture.md` avec diagramme Mermaid (flux d'une analyse, composants, frontières de sécurité).
- `adr/` : hébergement Vercel, choix du stockage, structure du dépôt, bandeau maison, mapping RGAA.
- `api.md` : endpoints, schémas, codes d'erreur.
- `scoring.md` : méthode de calcul et limites, en langage clair.
- `rgaa-mapping.md` : méthode, sources, comment ajouter une règle, préparation du RGAA 5.
- `securite.md` : modèle de menace, protections SSRF, limites.
- `exploitation.md` : variables d'environnement, déploiement, rollback, migration vers OVHcloud.
- `accessibilite/` : audits et grille (voir section 5).
- Les documents existants `docs/charte/` et `docs/maquette/` restent en place.

## 9. Ordre d'exécution

1. Vérifications, agents, CLAUDE.md, squelette du dépôt, création du dépôt GitHub, premier push.
2. Mapping RGAA et moteur d'analyse avec tests (en parallèle : `rgaa-mapper`, `backend-dev`, `test-engineer`).
3. API, stockage, sécurité, revue `security-reviewer`.
4. Front, charte, animations, pages légales, bandeau (en parallèle : `frontend-dev`, `docs-writer`).
5. Pages de démo et rapports pré-calculés.
6. Audit `a11y-auditor`, corrections jusqu'à zéro violation automatique.
7. CI complète, Vercel, Upstash, déploiement de prévisualisation, tests e2e contre la prévisualisation.
8. Déploiement en production, smoke test sur l'URL de production (analyse réelle d'une page publique, démo, pages légales), mise à jour de la homepage du dépôt et du README.
9. Première release via semantic-release.

Après chaque étape : CI verte, commit, court point d'avancement dans `docs/journal.md`.

## 10. Quand t'arrêter et me solliciter

Uniquement si :

- un compte n'est pas connecté (`gh`, `vercel`) ;
- une action exige le tableau de bord d'un service ou un paiement ;
- une vérification légale ou un fait introuvable bloque (dans ce cas, mets un placeholder visible `[À COMPLÉTER : …]` et continue si possible) ;
- une commande destructrice serait nécessaire hors du dossier du projet.

Ne force jamais (`--force`, suppression de dépôt, réécriture d'historique publié) sans mon accord.

## 11. Définition de « terminé »

- Application en production sur Vercel, accessible publiquement, analyse réelle fonctionnelle.
- CI verte, couverture atteinte, zéro violation axe sur les pages de Balise, Lighthouse à 90 minimum.
- Dépôt GitHub public, description, topics, homepage, README complet, release v1.0.0.
- Documentation complète dans `docs/`.
- Rapport final dans le terminal : URL de production, URL du dépôt, ce qui est fait, ce qui reste à faire par un humain (audit manuel RGAA, identifiant GA4 si absent, vérifications légales marquées « À COMPLÉTER »), limites connues.
