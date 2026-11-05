# Balise

Pré-diagnostic d'accessibilité RGAA, à partir d'une simple URL.

Balise analyse une page web, repère les erreurs d'accessibilité détectables automatiquement et les range par thématique du RGAA, avec un score indicatif par thématique et un score global. Le nom joue sur les deux sens du mot : la balise HTML, matière première de l'analyse, et la balise qui signale un danger sur une route ou en mer.

## Positionnement et ton

Balise est un outil honnête : il dit ce qu'il a testé, et surtout ce qu'il n'a pas testé. Chaque écran qui affiche un score affiche aussi sa couverture (« 31 critères testés automatiquement sur 106 ») et la mention « Scores indicatifs ».

- Vouvoiement dans l'interface : le public inclut des collectivités et des organismes publics.
- Phrases courtes, verbes d'action : « Analyser la page », « Voir les 12 erreurs », « Copier le code ».
- On explique le problème avant la règle : « Cette image n'a pas d'alternative textuelle : un lecteur d'écran ne peut pas la décrire. » puis le lien vers le critère 1.1.
- Jamais de promesse de conformité. À bannir : « conforme RGAA », « certifié », « 100 % accessible ». À utiliser : « aucune erreur détectée automatiquement ».

## Logo

Le symbole associe une jauge ouverte (le score) et une coche (la validation). Il existe en trois fichiers dans le groupe Logos : logo horizontal pour fond clair, logo horizontal pour fond sombre, symbole seul.

- Taille minimale : 24 px pour le symbole, 120 px de large pour le logo horizontal.
- Zone de protection : un quart de la hauteur du symbole tout autour.
- Le symbole garde toujours son fond vert brand (#0E5C4A), y compris en thème sombre : la coche ambre ne serait pas lisible sur le vert clair du thème sombre.
- Le mot « Balise » des fichiers horizontaux utilise Atkinson Hyperlegible Next si elle est installée, sinon Verdana. Pour une version définitive, vectoriser le texte.

## Couleurs

Un vert profond porte la marque, un ambre l'accompagne en touche décorative, trois couleurs de statut servent aux scores. Tous les textes atteignent 4,5:1 sur leur fond dans les deux thèmes.

- brand : boutons principaux, liens, anneau de focus (2 px, décalé de 2 px).
- accent : logo et illustrations seulement. Jamais de texte ambre sur fond clair (contraste 2:1).
- score-good, score-warn, score-bad, score-manual : jauges et badges de statut. Ces couleurs ont des clartés proches : elles ne portent jamais l'information seules. Chaque statut a son icône (coche, triangle, croix, œil) et son libellé, conformément au critère RGAA 3.1.
- Pas de bleu-blanc-rouge ni de bleu France : Balise n'est pas un service de l'État et ne doit pas pouvoir être confondu avec un site public officiel.

## Typographie

- Texte et titres : Atkinson Hyperlegible Next, du Braille Institute, conçue pour la lisibilité des personnes malvoyantes. Licence SIL Open Font License 1.1, graisses 200 à 800. Un choix cohérent avec le sujet de l'outil.
- Code et sélecteurs CSS : JetBrains Mono, licence SIL Open Font License 1.1.
- Corps de texte à 17 px : un cran au-dessus de l'habitude, pour la lisibilité.
- En production, auto-héberger les polices (fichiers woff2 servis par Balise) au lieu de les charger depuis les serveurs de Google, pour ne transmettre aucune adresse IP de visiteur à un tiers (RGPD).

## Formes et espacements

- Rayons : radius-md (10 px) pour boutons, champs et cartes ; radius-sm (6 px) pour badges et extraits de code ; radius-lg (16 px) pour les panneaux.
- Grille de 4 px. Espacements courants : space-4 dans les cartes, space-6 entre cartes, space-12 entre sections.
- Pas d'ombres portées : les cartes se détachent par surface-raised et une bordure border.

## Iconographie

- Icônes au trait, épaisseur 2 px, coins arrondis, 20 ou 24 px. Jeu recommandé : Lucide (licence ISC), à vérifier avant usage.
- Une icône à côté d'un libellé reste décorative (aria-hidden). Une icône seule porte un nom accessible.
- Jauges de score : arc ouvert en bas, comme le symbole, avec le chiffre au centre en style score.

## Accessibilité de l'interface

Balise doit être exemplaire sur ce qu'il mesure.

- Navigation complète au clavier, focus toujours visible (brand, 2 px).
- Chaque jauge a un nom accessible du type « Images : 78 sur 100, 4 critères testés sur 9 ».
- Les thèmes clair et sombre suivent la préférence système et restent modifiables.
- Les animations de chargement respectent prefers-reduced-motion.
