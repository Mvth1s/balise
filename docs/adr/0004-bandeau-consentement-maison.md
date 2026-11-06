# ADR 0004 — Bandeau de consentement maison

- Statut : acceptée
- Date : 2026-11-05
- Auteur : Mvth1s

## Contexte

Balise peut mesurer son audience avec Google Analytics 4 (GA4). En France, le dépôt de cookies de mesure d'audience par GA4 exige le consentement préalable de l'utilisateur : GA4 ne remplit pas les conditions d'exemption fixées par la CNIL (finalité strictement limitée à la mesure d'audience pour le compte de l'éditeur, statistiques anonymes, aucun partage avec un tiers).

Source : https://www.cnil.fr/fr/cookies-et-autres-traceurs/regles/cookies-solutions-pour-les-outils-de-mesure-daudience (consulté le 2026-11-05).

Contraintes propres à Balise :

- Balise doit être exemplaire en accessibilité ; le bandeau en fait partie (clavier, focus, contraste, zoom, lecteurs d'écran).
- Aucun appel à un tiers avant consentement (polices auto-hébergées, pas de script Google).
- CSP stricte.

Les plateformes de gestion du consentement (CMP) du marché chargent souvent un script tiers, posent leurs propres traceurs et ont une accessibilité inégale.

## Décision

Un bandeau développé dans Balise, sans bibliothèque tierce :

- **Affiché seulement si `VITE_GA_MEASUREMENT_ID` est défini.** Sans identifiant, aucun code GA4 n'est chargé et aucun bandeau n'apparaît.
- **Non bloquant** : la page reste lisible et utilisable.
- **Boutons « Tout refuser » et « Tout accepter » de même apparence** et même niveau ; lien « Personnaliser mes choix » vers la page « Gestion des cookies ».
- **Aucune case pré-cochée.**
- **Choix conservé 6 mois** dans le stockage local, avec sa date ; à l'échéance, la question est reposée.
- **Retrait à tout moment** depuis la page « Gestion des cookies » (interrupteur), lien présent dans le pied de page de chaque page. Au retrait, Balise repasse le consentement à « refusé », désactive GA4 (`ga-disable-<ID>`) et efface les cookies `_ga` et `_ga_<ID>` qu'il peut atteindre (`apps/web/src/lib/analytics.ts`).
- **Aucun script Google avant consentement** : `gtag.js` n'est injecté qu'après acceptation (Consent Mode en mode basique). La CSP est un en-tête statique (`vercel.json`) : elle autorise en permanence les domaines de Google Analytics, faute de pouvoir changer d'en-tête selon le choix de l'utilisateur. La garantie « aucun appel avant consentement » repose donc sur le code du front ; les tests e2e du bandeau doivent vérifier qu'aucune requête ne part vers Google avant acceptation.
- **Configuration GA4** : signaux Google et personnalisation publicitaire désactivés, durée des cookies limitée à 13 mois (la durée par défaut de Google est de 2 ans : https://support.google.com/analytics/answer/11397207?hl=fr, consulté le 2026-11-05).
- **Accessibilité** : région nommée, ordre de tabulation logique, focus visible, aucune capture du focus, textes au contraste suffisant, fonctionnement à 200 % de zoom et à 320 px. Couvert par les tests e2e (refus, acceptation, retrait) avec axe.

## Conséquences

Positives :

- Zéro dépendance et zéro requête tierce supplémentaire.
- Accessibilité maîtrisée et testée comme le reste de Balise.
- Textes en français, au ton de Balise.

Négatives :

- Maintenance à notre charge : évolution des recommandations de la CNIL, du Consent Mode de Google.
- Pas de registre centralisé des consentements : le choix est conservé uniquement dans le navigateur de l'utilisateur. Suffisant ici, car Balise n'a pas de compte utilisateur.

## Alternatives étudiées

- **CMP commerciale ou open source** (tarteaucitron.js, Axeptio, Didomi…) : solutions éprouvées, mais script supplémentaire, apparence et accessibilité moins maîtrisées, parfois traceurs propres.
- **Outil de mesure exempté de consentement** (configuré selon les conditions de la CNIL) : aurait évité le bandeau. Écarté car la spécification impose GA4 ; option à reconsidérer.
- **Pas de mesure d'audience** : solution la plus sobre, possible en laissant `VITE_GA_MEASUREMENT_ID` vide.
