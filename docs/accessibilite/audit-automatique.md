# Audit automatique d’accessibilité de Balise

Audit outillé de l’interface de Balise elle-même (pas des sites analysés), réalisé le 2026-11-06 par l’agent `a11y-auditor`. Il complète, sans la remplacer, la grille d’audit manuel ([grille-audit-manuel.md](grille-audit-manuel.md)) : un audit automatique ne détecte qu’une partie des non-conformités possibles, et aucun résultat ci-dessous ne vaut déclaration de conformité.

## Méthode

1. Build du front : `pnpm --filter @balise/web build` (branche `feat/engine-api`, arbre de travail du 2026-11-06). Second build, dans un dossier séparé (sans toucher à `apps/web/dist`), avec `VITE_GA_MEASUREMENT_ID=G-TEST000000` pour le bandeau de consentement.
2. Service : `BALISE_E2E_FAKE_ANALYZER=1 PORT=4310 node --experimental-strip-types scripts/e2e-server.ts` (mêmes règles que Vercel, API locale, faux moteur). Une copie du serveur pointant sur le build GA4 sur le port 4311 ; les requêtes vers Google sont interceptées et ne quittent pas la machine.
3. Suite e2e du dépôt (`e2e/`, axe + clavier + affichage) lancée contre ce serveur.
4. Scripts Playwright ad hoc (hors dépôt) :
   - axe-core sur chaque page et chaque état, thèmes clair et sombre (préférence enregistrée avant chargement), tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` (bloquants), puis `best-practice` (pour information) ; relevé des résultats « incomplete » ;
   - parcours clavier complet à la touche Tab sur chaque page, thème clair et sombre : ordre, pièges, présence d’un indicateur de focus (outline, ombre ou `:focus-within` d’un ancêtre), contraste de l’indicateur avec le fond, élément visible et non masqué (`elementFromPoint`) ;
   - gestion du focus : lien d’évitement, changement de route, ancres, fin d’analyse, annulation, erreurs de formulaire, consentement, filtres, liste de contrôle, copie de lien ;
   - redimensionnement : 320 px CSS (équivalent zoom 400 %), 640 px CSS (zoom 200 % sur écran 1280), texte seul à 200 % (`font-size` racine), espacement du texte WCAG 1.4.12 (à 320 px et 1280 px) : défilement horizontal, éléments hors fenêtre, textes tronqués ;
   - `prefers-reduced-motion` : animations et transitions déclarées ou en cours, valeur des jauges au premier affichage, interrupteur « Animations » ;
   - arbre d’accessibilité (`ariaSnapshot`) de chaque état : noms, rôles, états des jauges, interrupteurs, barre de progression, régions live ;
   - métadonnées : `lang`, titre de page, hiérarchie des titres, landmarks, `noindex` ;
   - contrastes calculés depuis `docs/charte/tokens.json` (formule WCAG 2.x) pour toutes les paires texte/fond et composant/fond utilisées par l’interface.

## Outils et versions

| Outil                                              | Version                         |
| -------------------------------------------------- | ------------------------------- |
| Node.js                                            | 24.22.2                         |
| pnpm                                               | 12.15.0                         |
| Vue / vue-router / Vite / vite-ssg                 | 3.5.44 / 5.4.0 / 8.3.5 / 28.3.0 |
| Playwright (`@playwright/test`, `playwright-core`) | 1.63.0                          |
| Chromium (Playwright)                              | 153.0.8010.12                   |
| axe-core / `@axe-core/playwright`                  | 4.14.0 / 4.14.0                 |

## Pages et états audités

Chaque état a été audité en thème clair et en thème sombre (112 combinaisons pour axe, plus 8 pour le bandeau de consentement).

| Page                                                          | États                                                                                                                                                                                                                                               |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/` Accueil                                                   | vide ; erreur de saisie (adresse invalide) ; adresse valide ; erreur API 422 (adresse refusée) ; erreur API 429 (limite atteinte) ; erreur réseau                                                                                                   |
| `/analyses/:id` Analyse                                       | en cours (étape 4 sur 5) ; annulée ; rapport ; rapport avec filtres actifs (tous statuts + thématique) ; rapport avec filtres sans résultat ; rapport avec accordéons ouverts et liste de contrôle cochée ; page inaccessible ; analyse introuvable |
| `/analyses`                                                   | sans identifiant                                                                                                                                                                                                                                    |
| `/exemple`, `/exemple/avant`, `/exemple/apres`                | page complète                                                                                                                                                                                                                                       |
| `/demo/apres`                                                 | page complète                                                                                                                                                                                                                                       |
| `/demo/avant`                                                 | bandeau d’avertissement et `noindex` uniquement (page volontairement fautive, exclue)                                                                                                                                                               |
| Pages légales                                                 | `/mentions-legales`, `/confidentialite`, `/cookies`, `/accessibilite`, `/conditions-utilisation`, `/plan-du-site`, `/contact`                                                                                                                       |
| 404                                                           | `/cette-page-n-existe-pas` (statut 404)                                                                                                                                                                                                             |
| Bandeau de consentement (build avec `VITE_GA_MEASUREMENT_ID`) | bandeau affiché ; confirmation après refus ; `/cookies` avec interrupteur ; `/cookies` après enregistrement                                                                                                                                         |

## Résultats

### axe-core

- **0 violation WCAG** (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`) sur toutes les pages, tous les états, dans les deux thèmes, y compris le bandeau de consentement et le bandeau d’avertissement de `/demo/avant`.
- **0 violation `best-practice`**.
- Résultats « à revoir » (incomplete) : uniquement `color-contrast` sur le texte SVG des jauges (`.gauge__number`, `.gauge__suffix`), qu’axe ne sait pas évaluer. Contraste vérifié à la main : `ink` sur `surface-raised` (16,66:1 clair, 14,39:1 sombre) et `ink-muted` sur `surface-raised` (6,20:1 et 7,34:1).

### Suite e2e du dépôt

124 tests (projets `chromium` et `mobile-320`) : 97 à 99 réussis, 25 ignorés par conception (logique de consentement testée sur un seul projet, etc.). Deux échecs intermittents au premier passage (`analysis.spec.ts` « export JSON », `display.spec.ts` « jauges qui se remplissent »), réussis au second ; un échec de « limite atteinte après 10 analyses » au troisième passage, dû à la réutilisation du même serveur (compteur de débit déjà entamé par le passage précédent), sans lien avec l’accessibilité.

### Clavier et focus

- Parcours complet sans piège sur toutes les pages (la tabulation revient au document après le pied de page), dans les deux thèmes ; 222 arrêts sur un rapport, 243 sur `/exemple/avant`.
- Lien d’évitement « Aller au contenu » : premier arrêt, visible au focus, déplace le focus sur `<main>` ; la tabulation suivante atteint le champ d’adresse.
- Indicateur de focus présent sur tous les éléments sauf le cadre de `/demo/apres` (anomalie A2). Contraste minimal de l’anneau avec le fond adjacent : 6,70:1 en clair, 6,25:1 en sombre (seuil 3:1). Aucun élément focalisé masqué ni hors écran.
- Changement de route : le focus va sur le `<h1>` de la nouvelle page (navigation principale, pied de page, retour arrière). Fin d’analyse : focus sur le `<h1>` « Rapport de pré-diagnostic » et annonce « Analyse terminée. Le rapport est affiché. ». Annulation : focus sur le `<h1>` « Analyse annulée ».
- Formulaire : soumission invalide → focus sur le champ, `aria-invalid="true"`, message relié par `aria-describedby` ; erreur API → `role="alert"`, focus sur le champ.
- Consentement : bandeau atteint juste après le lien d’évitement ; après choix, focus sur le message de confirmation (`role="status"`) ; après « Fermer ce message », focus sur `<main>`. Interrupteur de `/cookies` : focus visible sur son libellé (`:focus-within`), activable à la barre d’espace.
- Filtres du rapport (`aria-pressed`), sélecteur de thématique, liste de contrôle, « Copier le lien du rapport » : utilisables au clavier, résultats annoncés par des régions `role="status"` (« 4 critères affichés », « 1 sur 99 cochés… », « Lien du rapport copié. »).
- Anomalie : navigation vers l’ancre « Comment ça marche » (A1).

### Affichage

- 320 px (zoom 400 %), 640 px (zoom 200 %), texte seul à 200 % : aucun défilement horizontal, aucun élément hors fenêtre ni texte tronqué, sur toutes les pages et états (rapport avec accordéons ouverts, analyse en cours avec une adresse longue, erreur API, bandeau de consentement).
- Espacement du texte (WCAG 1.4.12) : conforme à 1 280 px ; à 320 px, débordement du sélecteur de thématique du rapport (A5).
- `prefers-reduced-motion: reduce` : `data-motion="off"`, aucune animation ni transition déclarée, jauges affichées directement à leur valeur finale. Sans préférence système, l’interrupteur « Animations » coupe tout (même résultat). Aucun contenu en mouvement automatique ni clignotant (hors `/demo/avant`).

### Structure, langue, titres

- `lang="fr"` sur toutes les pages ; passage en anglais balisé (`<q lang="en">` sur `/demo/apres`, liens de documentation `hreflang="en"` annoncés « (en anglais) »).
- Un seul `<h1>` par page, hiérarchie sans saut (hors `/demo/avant`) ; un `<main>`, un `banner`, un `contentinfo` ; navigations nommées « Navigation principale », « Fil d’Ariane » (pages légales), « Liens de pied de page ».
- Titres de page uniques et pertinents ; pages d’analyse et 404 en `noindex, nofollow` ; `/demo/avant` : en-tête `X-Robots-Tag: noindex` et `<meta name="robots" content="noindex, nofollow">`, bandeau `role="note"` « Page de démonstration avec erreurs volontaires ». Anomalie : titre de `/analyses` sans identifiant (A3).

### Arbre d’accessibilité

- Jauges : `img` avec nom complet, par exemple « Score global indicatif : 43 sur 100, palier Nombreuses erreurs, 7 critères testés sur 106 » ; « Cadres : non évaluable, aucun critère testé automatiquement sur 2 ».
- Barre de progression : `progressbar` « Avancement de l’analyse » avec `aria-valuetext` (« 60 %, étape 4 sur 5 ») ; annonce de chaque étape par `role="status"` (« Étape 4 sur 5 : Tests automatiques RGAA. »).
- Interrupteurs : `switch "Animations" [checked]` (avec description « Réduites par votre système » quand la préférence système s’applique), `switch "Mesure d’audience (Google Analytics 4)"`.
- Sélecteur de thème : `combobox "Thème"`. Filtres : boutons à `aria-pressed`. Capture d’écran et accordéons : `details/summary` natifs.

### Couleur et contrastes (depuis `docs/charte/tokens.json`)

Toutes les paires utilisées respectent les seuils dans les deux thèmes. Extrait (clair / sombre) :

| Paire                                                                                   | Clair                 | Sombre                | Seuil |
| --------------------------------------------------------------------------------------- | --------------------- | --------------------- | ----- |
| `ink` sur `surface` / `surface-raised` / `brand-soft`                                   | 15,71 / 16,66 / 14,07 | 16,05 / 14,39 / 11,95 | 4,5   |
| `ink-muted` sur `surface` / `surface-raised` / `brand-soft`                             | 5,85 / 6,20 / 5,24    | 8,19 / 7,34 / 6,10    | 4,5   |
| `brand` (liens) sur `surface` / `surface-raised` / `brand-soft`                         | 7,48 / 7,93 / 6,70    | 8,39 / 7,52 / 6,25    | 4,5   |
| `score-good` sur `surface` / `surface-raised`                                           | 5,07 / 5,38           | 8,77 / 7,87           | 4,5   |
| `score-warn` sur `surface` / `surface-raised`                                           | 4,60 / 4,87           | 8,73 / 7,83           | 4,5   |
| `score-bad` sur `surface` / `surface-raised`                                            | 6,16 / 6,54           | 7,22 / 6,47           | 4,5   |
| `score-manual` sur `surface` / `surface-raised`                                         | 5,85 / 6,20           | 8,19 / 7,34           | 4,5   |
| `on-brand` sur `brand` (bouton principal)                                               | 7,93                  | 7,88                  | 4,5   |
| `border-strong` (champs, boutons secondaires, filtres) sur `surface` / `surface-raised` | 3,04 / 3,22           | 3,83 / 3,43           | 3     |
| `brand` (anneau de focus, interrupteur actif) sur `surface` / `surface-raised`          | 7,48 / 7,93           | 8,39 / 7,52           | 3     |

Hors seuil mais sans non-conformité actuelle : `border` (1,32 à 1,48:1), réservé aux séparateurs décoratifs et à la piste des jauges, dont la valeur est aussi donnée en texte ; `score-warn` sur `brand-soft` en clair (4,12:1), combinaison non utilisée aujourd’hui ; bouton principal `aria-disabled` (opacité 0,75) en clair, 4,32:1, exempté (composant inactif). Voir A6 et A7.

La couleur ne porte jamais seule l’information : paliers et statuts avec icône et libellé, étapes avec icône et texte (« Terminé », « En cours », « À venir »), filtres actifs avec coche et graisse, champ en erreur avec message, liens soulignés.

## Anomalies

Aucune anomalie bloquante. Gravité : **majeure** = non-conformité à un critère RGAA sur une page de l’échantillon ; **mineure** = non-conformité limitée ou dans une configuration particulière ; **information** = amélioration recommandée, sans non-conformité.

### A1. Majeure : le focus ne suit pas la navigation vers l’ancre « Comment ça marche »

- Critère : RGAA 12.8 (ordre de tabulation cohérent) ; WCAG 2.4.3.
- Pages : toutes (lien de la navigation principale `/#methode`), visible sur `/` et depuis `/exemple`.
- Élément : `.site-header__nav a[href="/#methode"]` ; cible `section#methode`.
- Constat : la page défile jusqu’à la section (scrollY 466) mais le focus reste sur le lien de l’en-tête ; la tabulation suivante atteint « Exemple de rapport » et ramène la page en haut (scrollY 0). Sur `/`, `App.vue` ignore la navigation (`to.path === from.path`) ; depuis une autre page, il ne déplace pas le focus quand `to.hash` est présent.
- Correctif : dans `router.afterEach` (`apps/web/src/App.vue`), quand `to.hash` est défini et diffère de `from.hash`, déplacer le focus sur la cible avec `focusElement` (de `lib/focus.ts`), par exemple sur le titre `#methode-titre`, ou sur la section avec `tabindex="-1"` ; ne garder le retour anticipé que si le chemin **et** l’ancre sont identiques. Ajouter un test e2e : après activation du lien, `document.activeElement` est dans `#methode` et Tab atteint le premier élément suivant.

### A2. Majeure : focus invisible sur le cadre de `/demo/apres`

- Critère : RGAA 10.7 (prise de focus visible) ; WCAG 2.4.7.
- Page : `/demo/apres` (même cadre sur `/demo/avant`, exclue).
- Élément : `iframe.demo-frame` (« Plan d’accès à la médiathèque »).
- Constat : sous Chromium, le cadre (document `srcdoc` sans élément interactif) est un arrêt de tabulation ; le focus est alors porté par le document du cadre, qui ne correspond à aucun sélecteur `:focus`, `:focus-visible` ni `:focus-within` côté page. Aucun indicateur n’est affiché.
- Correctif : le cadre est de même origine (`srcdoc`) ; dans `DemoView.vue`, écouter `focus`/`blur` sur `iframe.contentWindow` (au `load`) pour poser une classe, par exemple `.demo-frame--focus { outline: 2px solid var(--color-brand); outline-offset: 2px; }`. Garder le cadre dans l’ordre de tabulation : son contenu peut nécessiter un défilement au zoom. Les styles inline sont interdits par la CSP (`style-src 'self'`) et le document du cadre en hérite : aucun `<style>` dans `srcdoc`.

### A3. Mineure : titre de `/analyses` sans identifiant non pertinent

- Critère : RGAA 8.6 (titre de page pertinent) ; WCAG 2.4.2.
- Page : `/analyses` (et tout `/analyses/` sans identifiant).
- Constat : titre « Analyse en cours – Balise » alors que la page affiche « Aucune analyse indiquée ». Le squelette pré-rendu affiche « Analyse » / « Chargement de l’analyse… » sous ce même titre.
- Correctif : dans `AnalysisView.vue`, `usePageMeta({ title: () => !id.value ? 'Aucune analyse indiquée' : report.value ? … : error.value ? … : 'Analyse en cours' })`, et un titre neutre (« Analyse ») tant que `mounted` est faux.

### A4. Mineure : `aria-current="page"` sur « Comment ça marche » en page d’accueil

- Critère : RGAA 7.1 (état restitué par les technologies d’assistance) ; WCAG 4.1.2.
- Page : `/`.
- Élément : `.site-header__nav a[href="/#methode"]`.
- Constat : vue-router ignore l’ancre pour l’état « exact actif » ; sur l’accueil, le logo et « Comment ça marche » portent tous deux `aria-current="page"`. Un lecteur d’écran annonce « page actuelle » sur un lien qui mène à une section.
- Correctif : rendre ce lien avec `<RouterLink to="/#methode" custom v-slot="{ href, navigate }"><a :href="href" @click="navigate">Comment ça marche</a></RouterLink>`, sans `aria-current`.

### A5. Mineure : le sélecteur « Thématique » déborde à 320 px avec l’espacement du texte augmenté

- Critère : RGAA 10.12 (espacement du texte redéfini sans perte) ; WCAG 1.4.12 combiné à 1.4.10.
- Pages : rapport (`/analyses/:id`), `/exemple/avant`, `/exemple/apres`.
- Élément : `#filtre-theme` (`.filters__group`, `select.field-input.filters__select`).
- Constat : avec `letter-spacing: .12em; word-spacing: .16em; line-height: 1.5`, la largeur intrinsèque du `<select>` (option la plus longue) atteint 371 px pour une fenêtre de 320 px : défilement horizontal. Sans espacement modifié, aucun débordement.
- Correctif : `.filters__group { min-width: 0; max-width: 100%; }` et `.filters__select { max-width: 100%; }` (ou `width: 100%` sous 30rem).

### A6. Information : bouton principal `aria-disabled` à 4,32:1 en thème clair

- Critère : RGAA 3.2, cas des composants inactifs (exemptés) ; WCAG 1.4.3.
- Page : `/` pendant l’envoi (« Lancement de l’analyse… »).
- Élément : `.btn[aria-disabled="true"]` (`opacity: 0.75`).
- Constat : `on-brand` sur `brand` à 75 % sur `surface` donne 4,32:1 (4,98:1 en sombre). Exempté parce que le composant est inactif, mais le libellé reste une information utile.
- Correctif proposé : `opacity: 0.85`, ou fond et texte dédiés sans transparence, avec un contraste d’au moins 4,5:1.

### A7. Information : paires de la charte à documenter comme interdites

- Critère : RGAA 3.2 (prévention).
- Constat : `score-warn` sur `brand-soft` donne 4,12:1 en clair ; `border` sur les surfaces, 1,32 à 1,48:1. Ces combinaisons ne sont pas utilisées pour du texte ni comme seule limite d’un composant aujourd’hui.
- Correctif proposé : mentionner dans `docs/charte/` que `score-warn` ne doit pas être posé sur `brand-soft` (par exemple dans un filtre actif ou une note).

### A8. Information : texte « sur 100 » de 10 px dans les jauges de `/exemple`

- Critère : aucun critère RGAA (le texte s’agrandit avec le zoom) ; lisibilité.
- Page : `/exemple` (`.compare__score .gauge[width="120"] .gauge__suffix`).
- Constat : `font-size: 10px` dans un `viewBox` de 120 rendu à 120 px, soit 10 px CSS.
- Correctif proposé : passer `.gauge__suffix` à 12 ou 13 unités, ou n’afficher le suffixe qu’à partir de 168 px.

### A9. Information : outils de lecture sous CSP stricte

- Constat : la CSP `style-src 'self'` bloque les bookmarklets qui injectent un `<style>` (par exemple l’espacement du texte). Les extensions de navigateur et les feuilles de style utilisateur ne sont pas concernées. Pas de non-conformité ; à mentionner dans la déclaration d’accessibilité si un utilisateur le signale.

## Limites

- Un seul moteur (Chromium 153) ; ni Firefox ni Safari, ni lecteur d’écran réel (NVDA, JAWS, VoiceOver, TalkBack), ni mode de contraste forcé (`forced-colors`, styles présents mais non vérifiés visuellement).
- Le zoom est simulé par la largeur de fenêtre et le facteur d’échelle, pas par le zoom du navigateur.
- Rapport produit par le faux moteur d’e2e, plus court qu’un rapport réel ; un rapport réel volumineux (beaucoup d’éléments, longs extraits HTML) reste à vérifier, notamment à 320 px.
- Les pertinences (alternatives, intitulés, titres, ordre de lecture, compréhension des messages) relèvent de l’audit manuel : voir [grille-audit-manuel.md](grille-audit-manuel.md).
