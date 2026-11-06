/**
 * Rule → RGAA 4.1.2 criteria mappings (axe-core 4.14.0 + Balise custom checks).
 *
 * This file is the editable source of the `rules` array of
 * `src/data/rgaa-4.1.2.json`. Edit it, then regenerate the JSON with
 * `scripts/generate-rgaa-4.1.2.ts` (see docs/rgaa-mapping.md).
 *
 * Decision rules (see docs/rgaa-mapping.md):
 * - `full` only when a pass of the rule on its applicable elements is enough to
 *   judge the whole criterion compliant; otherwise `partial`.
 * - When in doubt, the rule is not mapped at all.
 */
import type { RuleMapping } from '../src/types.ts';

/** Date on which the axe-core rule pages and RGAA pages were reviewed. */
export const REVIEWED_ON = '2026-11-05';
export const AXE_VERSION = '4.14.0';

const RGAA_URL = 'https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/';

type Coverage = RuleMapping['coverage'];

function axe(
  rule: string,
  criteria: string[],
  coverage: Coverage,
  rationale: string,
  explanation: string,
  fix: string,
): RuleMapping {
  return {
    rule,
    engine: 'axe',
    criteria,
    coverage,
    rationale,
    explanation,
    fix,
    source: {
      url: `https://dequeuniversity.com/rules/axe/4.14/${rule}`,
      retrieved: REVIEWED_ON,
      note: `axe-core ${AXE_VERSION}`,
    },
  };
}

function balise(
  rule: string,
  criteria: string[],
  coverage: Coverage,
  rationale: string,
  explanation: string,
  fix: string,
): RuleMapping {
  return {
    rule,
    engine: 'balise',
    criteria,
    coverage,
    rationale,
    explanation,
    fix,
    source: {
      url: `${RGAA_URL}#${criteria[0]}`,
      retrieved: REVIEWED_ON,
      note: 'Contrôle maison Balise (packages/analyzer), correspondance établie d’après le critère officiel.',
    },
  };
}

export const RULES: RuleMapping[] = [
  // 1. Images
  axe(
    'image-alt',
    ['1.1'],
    'partial',
    'Test 1.1.1 : une balise <img> sans alternative textuelle est non conforme ; un succès ne dit pas si l’image est porteuse d’information (alt vide possible).',
    'Cette image n’a pas d’alternative textuelle : un lecteur d’écran ne peut pas la décrire.',
    'Ajoutez un attribut alt décrivant l’information portée par l’image, ou alt="" si elle est décorative.',
  ),
  axe(
    'input-image-alt',
    ['1.1'],
    'partial',
    'Test 1.1.3 : chaque bouton de type image doit avoir une alternative textuelle ; la règle ne couvre pas les autres types d’images du critère.',
    'Ce bouton image n’a pas d’alternative textuelle : son action n’est pas annoncée par un lecteur d’écran.',
    'Ajoutez un attribut alt à la balise <input type="image"> décrivant l’action du bouton.',
  ),
  axe(
    'area-alt',
    ['1.1'],
    'partial',
    'Test 1.1.2 : chaque zone <area> d’une image réactive doit avoir une alternative textuelle ; la règle ne couvre pas les autres types d’images du critère.',
    'Cette zone d’image réactive n’a pas d’alternative textuelle : sa destination n’est pas annoncée.',
    'Ajoutez un attribut alt à chaque balise <area> indiquant sa destination ou sa fonction.',
  ),
  axe(
    'role-img-alt',
    ['1.1'],
    'partial',
    'Test 1.1.1 : un élément avec role="img" porteur d’information doit avoir une alternative textuelle ; un succès ne juge pas les autres images.',
    'Cet élément est déclaré comme image (role="img") mais n’a pas d’alternative textuelle.',
    'Ajoutez un attribut aria-label ou aria-labelledby décrivant l’image.',
  ),
  axe(
    'svg-img-alt',
    ['1.1'],
    'partial',
    'Test 1.1.5 : une image vectorielle <svg role="img"> porteuse d’information doit avoir une alternative textuelle ; un succès ne juge pas les autres images.',
    'Cette image SVG n’a pas d’alternative textuelle : un lecteur d’écran ne peut pas la décrire.',
    'Ajoutez un élément <title> dans le <svg> ou un attribut aria-label, en plus de role="img".',
  ),
  axe(
    'object-alt',
    ['1.1'],
    'partial',
    'Test 1.1.6 : une image objet <object> porteuse d’information doit avoir une alternative textuelle ; la règle vise toutes les balises <object>.',
    'Cet objet intégré (<object>) n’a pas d’alternative textuelle.',
    'Ajoutez une alternative textuelle (aria-label, title ou contenu de remplacement) à la balise <object>.',
  ),
  axe(
    'server-side-image-map',
    ['1.1'],
    'partial',
    'Test 1.1.4 : une image réactive côté serveur (attribut ismap) doit être doublée d’un mécanisme accessible ; la règle signale son usage.',
    'Cette image réactive côté serveur (ismap) n’est pas utilisable au clavier ni par un lecteur d’écran.',
    'Remplacez-la par une image réactive côté client (<map> et <area>) ou doublez-la de liens texte.',
  ),

  // 2. Cadres
  axe(
    'frame-title',
    ['2.1'],
    'partial',
    'Test 2.1.1 : chaque cadre doit avoir un attribut title ; axe accepte aussi aria-label, d’où une couverture partielle.',
    'Ce cadre (iframe) n’a pas de titre : on ne sait pas ce qu’il contient avant d’y entrer.',
    'Ajoutez un attribut title décrivant le contenu du cadre, par exemple title="Carte d’accès".',
  ),
  axe(
    'frame-title-unique',
    ['2.2'],
    'partial',
    'Test 2.2.1 : deux cadres portant le même titre ont peu de chances d’avoir chacun un titre pertinent ; la pertinence reste à vérifier.',
    'Plusieurs cadres portent le même titre : on ne peut pas les distinguer.',
    'Donnez à chaque cadre un attribut title unique qui décrit son contenu.',
  ),

  // 3. Couleurs
  axe(
    'color-contrast',
    ['3.2'],
    'partial',
    'Tests 3.2.1 à 3.2.4 : contraste du texte ; la règle ne mesure pas le texte en image ni les états au survol ou au focus.',
    'Ce texte n’est pas assez contrasté avec son arrière-plan : il est difficile à lire, en particulier pour les personnes malvoyantes.',
    'Augmentez le contraste jusqu’à 4,5:1 au moins (3:1 pour un texte de 24 px, ou 18,5 px en gras).',
  ),

  // 4. Multimédia
  axe(
    'video-caption',
    ['4.3'],
    'partial',
    'Tests 4.3.1 et 4.3.2 : une vidéo sans piste de sous-titres <track kind="captions"> est suspecte ; une version alternative sous-titrée peut exister.',
    'Cette vidéo n’a pas de sous-titres synchronisés : les personnes sourdes ou malentendantes n’ont pas accès au son.',
    'Ajoutez une piste <track kind="captions"> ou proposez une version sous-titrée via un lien adjacent.',
  ),
  axe(
    'no-autoplay-audio',
    ['4.10'],
    'partial',
    'Test 4.10.1 : un son déclenché automatiquement de plus de 3 secondes doit pouvoir être arrêté ; la règle ne couvre pas les sons lancés par script.',
    'Ce média lance du son automatiquement sans moyen simple de l’arrêter : il gêne la lecture d’écran.',
    'Supprimez la lecture automatique ou ajoutez les contrôles natifs (attribut controls) pour arrêter le son.',
  ),

  // 5. Tableaux
  axe(
    'th-has-data-cells',
    ['5.7'],
    'partial',
    'Test 5.7.1 : un en-tête <th> qui ne s’applique à aucune cellule indique une association en-têtes/cellules incorrecte.',
    'Cet en-tête de tableau ne correspond à aucune cellule de données : l’association des cellules à leurs en-têtes est faussée.',
    'Vérifiez la structure du tableau : chaque <th> doit s’appliquer à des cellules de données.',
  ),
  axe(
    'td-headers-attr',
    ['5.7'],
    'partial',
    'Test 5.7.4 : l’attribut headers doit lister les id des en-têtes associés du même tableau.',
    'Cette cellule fait référence, via l’attribut headers, à des en-têtes qui n’existent pas dans le tableau.',
    'Corrigez l’attribut headers pour qu’il liste les id des <th> du même tableau.',
  ),
  axe(
    'scope-attr-valid',
    ['5.7'],
    'partial',
    'Test 5.7.2 : l’attribut scope d’un <th> doit valoir « row » ou « col » selon l’en-tête.',
    'L’attribut scope est mal utilisé : les cellules ne sont pas correctement reliées à leurs en-têtes.',
    'Utilisez scope="col" ou scope="row" uniquement sur des balises <th>.',
  ),

  // 6. Liens
  axe(
    'link-name',
    ['6.2'],
    'full',
    'Test 6.2.1 : chaque lien doit avoir un intitulé ; la règle calcule le nom accessible (aria-labelledby, aria-label, contenu, title), conformément au glossaire RGAA.',
    'Ce lien n’a pas d’intitulé : un lecteur d’écran annonce seulement « lien », sans destination.',
    'Ajoutez un texte au lien, ou une alternative textuelle à l’image qu’il contient.',
  ),

  // 7. Scripts
  axe(
    'aria-allowed-attr',
    ['7.1'],
    'partial',
    'Test 7.1.1 : un attribut ARIA non autorisé pour le rôle de l’élément fausse la restitution du composant.',
    'Cet élément utilise un attribut ARIA qui n’est pas permis pour son rôle : il est mal restitué.',
    'Retirez l’attribut ARIA ou donnez à l’élément un rôle qui l’accepte.',
  ),
  axe(
    'aria-conditional-attr',
    ['7.1'],
    'partial',
    'Test 7.1.1 : un attribut ARIA utilisé hors des conditions prévues par la spécification fausse la restitution du composant.',
    'Cet attribut ARIA n’est pas utilisé comme le prévoit la spécification pour ce rôle.',
    'Utilisez l’attribut ARIA conformément à la spécification WAI-ARIA du rôle concerné.',
  ),
  axe(
    'aria-deprecated-role',
    ['7.1'],
    'partial',
    'Test 7.1.1 : un rôle ARIA obsolète peut ne pas être restitué par les technologies d’assistance.',
    'Cet élément utilise un rôle ARIA obsolète : il risque de ne pas être restitué.',
    'Remplacez le rôle obsolète par un rôle ARIA actuel ou par l’élément HTML natif équivalent.',
  ),
  axe(
    'aria-prohibited-attr',
    ['7.1'],
    'partial',
    'Test 7.1.1 : un attribut ARIA interdit pour le rôle de l’élément n’est pas restitué correctement.',
    'Cet élément porte un attribut ARIA interdit pour son rôle : l’information n’est pas transmise.',
    'Retirez l’attribut ARIA interdit, ou placez le texte dans le contenu de l’élément.',
  ),
  axe(
    'aria-required-attr',
    ['7.1'],
    'partial',
    'Test 7.1.1 : un composant ARIA privé d’un attribut obligatoire n’expose pas son état ou sa valeur.',
    'Ce composant ARIA n’a pas tous les attributs obligatoires pour son rôle : son état n’est pas annoncé.',
    'Ajoutez les attributs ARIA requis par le rôle (par exemple aria-checked pour role="checkbox").',
  ),
  axe(
    'aria-required-children',
    ['7.1'],
    'partial',
    'Test 7.1.1 : un composant ARIA sans les enfants requis par son rôle est mal restitué (axe indique 9.3.1, mais la règle vise surtout des composants d’interface).',
    'Ce composant ARIA ne contient pas les éléments enfants requis par son rôle.',
    'Ajoutez les éléments enfants attendus (par exemple role="tab" dans role="tablist").',
  ),
  axe(
    'aria-required-parent',
    ['7.1'],
    'partial',
    'Test 7.1.1 : un élément ARIA hors du conteneur requis par son rôle est mal restitué (axe indique 9.3.1, mais la règle vise surtout des composants d’interface).',
    'Cet élément ARIA n’est pas placé dans le conteneur requis par son rôle.',
    'Placez l’élément dans son conteneur attendu (par exemple role="option" dans role="listbox").',
  ),
  axe(
    'aria-roles',
    ['7.1'],
    'partial',
    'Test 7.1.1 : une valeur de rôle ARIA invalide empêche la restitution du rôle du composant.',
    'Cet élément a une valeur de rôle ARIA invalide : son rôle n’est pas annoncé.',
    'Utilisez une valeur de rôle ARIA valide ou un élément HTML natif.',
  ),
  axe(
    'aria-valid-attr-value',
    ['7.1'],
    'partial',
    'Test 7.1.1 : une valeur d’attribut ARIA invalide empêche la restitution de l’état ou des propriétés du composant.',
    'Cet attribut ARIA a une valeur invalide : l’état du composant n’est pas transmis.',
    'Corrigez la valeur de l’attribut ARIA (par exemple true ou false, ou un id existant).',
  ),
  axe(
    'aria-valid-attr',
    ['7.1'],
    'partial',
    'Test 7.1.1 : un attribut aria-* inexistant n’est pas pris en compte par les technologies d’assistance.',
    'Cet attribut ARIA n’existe pas (faute de frappe probable) : il est ignoré.',
    'Corrigez le nom de l’attribut ARIA d’après la spécification WAI-ARIA.',
  ),
  axe(
    'aria-tab-name',
    ['7.1'],
    'partial',
    'Test 7.1.3 : un onglet (role="tab") doit avoir un nom ; la pertinence reste à vérifier.',
    'Cet onglet n’a pas de nom accessible : on ne sait pas quel panneau il affiche.',
    'Ajoutez un texte à l’onglet, ou un attribut aria-label ou aria-labelledby.',
  ),
  axe(
    'aria-toggle-field-name',
    ['7.1'],
    'partial',
    'Test 7.1.3 : un composant ARIA à bascule (case, interrupteur, bouton radio) doit avoir un nom.',
    'Ce composant à cocher ou à bascule n’a pas de nom accessible : on ne sait pas ce qu’il active.',
    'Ajoutez un texte au composant, ou un attribut aria-label ou aria-labelledby.',
  ),
  axe(
    'aria-tooltip-name',
    ['7.1'],
    'partial',
    'Test 7.1.3 : une infobulle ARIA (role="tooltip") doit avoir un nom (critère WCAG 4.1.2).',
    'Cette infobulle n’a pas de nom accessible : son contenu n’est pas restitué.',
    'Placez un texte dans l’infobulle ou ajoutez un attribut aria-label ou aria-labelledby.',
  ),
  axe(
    'aria-braille-equivalent',
    ['7.1'],
    'partial',
    'Test 7.1.1 : aria-braillelabel ou aria-brailleroledescription sans équivalent non braille prive les autres utilisateurs du nom ou du rôle (WCAG 4.1.2).',
    'Cet élément a un libellé braille sans équivalent textuel : il n’est pas restitué par la synthèse vocale.',
    'Ajoutez un aria-label ou un aria-roledescription équivalent au libellé braille.',
  ),
  axe(
    'nested-interactive',
    ['7.1'],
    'partial',
    'Test 7.1.2 : des contrôles interactifs imbriqués ne sont pas correctement restitués par les technologies d’assistance.',
    'Ce contrôle interactif en contient un autre : les lecteurs d’écran risquent de ne pas annoncer le second.',
    'Séparez les éléments interactifs pour qu’aucun ne soit placé dans un autre.',
  ),
  axe(
    'frame-focusable-content',
    ['7.3'],
    'partial',
    'Test 7.3.2 (indice axe) : un cadre en tabindex="-1" rend son contenu interactif inatteignable au clavier.',
    'Ce cadre contient des éléments interactifs mais n’est pas atteignable au clavier (tabindex="-1").',
    'Retirez tabindex="-1" du cadre qui contient des éléments interactifs.',
  ),
  axe(
    'scrollable-region-focusable',
    ['7.3'],
    'partial',
    'Test 7.3.2 (indice axe) : une zone défilante sans élément focalisable ne peut pas être parcourue au clavier.',
    'Cette zone défilante ne peut pas être atteinte au clavier : son contenu caché reste inaccessible.',
    'Ajoutez tabindex="0" et un nom accessible à la zone défilante, ou placez-y un élément focalisable.',
  ),

  // 8. Éléments obligatoires
  axe(
    'duplicate-id-aria',
    ['8.2'],
    'partial',
    'Test 8.2.1 : les valeurs d’attribut id doivent être uniques ; la règle ne vérifie que les id référencés par ARIA ou les étiquettes, pas toute la validité du code.',
    'Cet id est utilisé plusieurs fois alors qu’il sert à une étiquette ou à un attribut ARIA : l’association est faussée.',
    'Donnez une valeur unique à chaque attribut id de la page.',
  ),
  axe(
    'html-has-lang',
    ['8.3'],
    'full',
    'Test 8.3.1 : la langue par défaut doit être indiquée ; la règle vérifie l’attribut lang (ou xml:lang en XHTML) de l’élément html.',
    'La langue de la page n’est pas indiquée : un lecteur d’écran risque de la lire avec une mauvaise prononciation.',
    'Ajoutez l’attribut lang à la balise <html>, par exemple <html lang="fr">.',
  ),
  axe(
    'html-lang-valid',
    ['8.4'],
    'partial',
    'Test 8.4.1 : le code de langue doit être valide et pertinent ; seule la validité est vérifiée automatiquement.',
    'Le code de langue de la page n’est pas valide : la synthèse vocale ne sait pas quelle langue utiliser.',
    'Utilisez un code de langue valide (BCP 47), par exemple lang="fr".',
  ),
  axe(
    'html-xml-lang-mismatch',
    ['8.4'],
    'partial',
    'Test 8.4.1 : des attributs lang et xml:lang divergents rendent le code de langue non pertinent (axe indique 8.3.1, mais la langue est bien présente).',
    'Les attributs lang et xml:lang de la page indiquent des langues différentes.',
    'Donnez la même langue aux attributs lang et xml:lang, ou retirez xml:lang en HTML5.',
  ),
  axe(
    'document-title',
    ['8.5'],
    'full',
    'Test 8.5.1 : chaque page doit avoir un titre (balise <title>) ; la règle vérifie sa présence et qu’il n’est pas vide.',
    'La page n’a pas de titre : on ne peut pas l’identifier dans les onglets ni à l’arrivée avec un lecteur d’écran.',
    'Ajoutez une balise <title> décrivant le contenu de la page, par exemple « Contact – Nom du site ».',
  ),
  axe(
    'valid-lang',
    ['8.8'],
    'partial',
    'Test 8.8.1 : le code de chaque changement de langue doit être valide et pertinent ; seule la validité est vérifiée.',
    'Ce passage indique une langue avec un code invalide : il ne sera pas lu avec la bonne prononciation.',
    'Utilisez un code de langue valide (BCP 47), par exemple lang="en".',
  ),

  // 9. Structuration de l'information
  axe(
    'list',
    ['9.3'],
    'partial',
    'Tests 9.3.1 et 9.3.2 : une liste <ul> ou <ol> doit contenir des <li> ; la règle ne repère pas les listes visuelles non balisées.',
    'Cette liste contient des éléments autres que des <li> : sa structure est mal restituée.',
    'Placez uniquement des balises <li> (ou <script>, <template>) directement dans <ul> et <ol>.',
  ),
  axe(
    'listitem',
    ['9.3'],
    'partial',
    'Tests 9.3.1 et 9.3.2 : un <li> doit être contenu dans une liste <ul> ou <ol>.',
    'Cet élément de liste (<li>) n’est pas placé dans une liste : il n’est pas annoncé comme tel.',
    'Placez les balises <li> dans une balise <ul> ou <ol>.',
  ),
  axe(
    'dlitem',
    ['9.3'],
    'partial',
    'Test 9.3.3 : les balises <dt> et <dd> doivent être contenues dans une liste de description <dl>.',
    'Ce terme ou cette définition (<dt> ou <dd>) n’est pas placé dans une liste de description.',
    'Placez les balises <dt> et <dd> dans une balise <dl>.',
  ),
  axe(
    'definition-list',
    ['9.3'],
    'partial',
    'Test 9.3.3 : une liste de description <dl> ne doit contenir que des groupes <dt>/<dd> correctement ordonnés.',
    'Cette liste de description (<dl>) est mal structurée.',
    'Ne placez dans <dl> que des groupes <dt> suivis de <dd> (éventuellement dans des <div>).',
  ),

  // 10. Présentation de l'information
  axe(
    'meta-viewport',
    ['10.4'],
    'partial',
    'Test 10.4.2 (indice axe) : bloquer le zoom via la balise meta viewport empêche d’agrandir le texte sur mobile.',
    'La page empêche le zoom (user-scalable=no ou maximum-scale trop faible) : le texte ne peut pas être agrandi.',
    'Retirez user-scalable=no et toute valeur maximum-scale inférieure à 2 de la balise meta viewport.',
  ),
  axe(
    'link-in-text-block',
    ['10.6'],
    'partial',
    'Test 10.6.1 : un lien signalé uniquement par la couleur doit contraster à 3:1 avec le texte environnant ; survol et focus restent à vérifier.',
    'Ce lien ne se distingue du texte qui l’entoure que par sa couleur : il peut passer inaperçu.',
    'Soulignez le lien, ou assurez un contraste de 3:1 avec le texte et un indice visuel au survol et au focus.',
  ),
  axe(
    'aria-hidden-body',
    ['10.8'],
    'partial',
    'Test 10.8.1 : aria-hidden="true" sur <body> masque tout le contenu aux technologies d’assistance alors qu’il n’a pas vocation à être ignoré.',
    'Toute la page est masquée aux lecteurs d’écran (aria-hidden="true" sur <body>).',
    'Retirez l’attribut aria-hidden de la balise <body>.',
  ),
  axe(
    'aria-hidden-focus',
    ['10.8'],
    'partial',
    'Test 10.8.1 : un élément masqué par aria-hidden mais focalisable est un contenu caché qui n’a pas vocation à être ignoré.',
    'Cet élément est masqué aux lecteurs d’écran mais reste atteignable au clavier : le focus arrive sur un contenu muet.',
    'Retirez aria-hidden, ou rendez le contenu non focalisable (tabindex="-1", inert).',
  ),
  axe(
    'avoid-inline-spacing',
    ['10.12'],
    'partial',
    'Test 10.12.1 : un espacement de texte imposé en style en ligne avec !important empêche l’utilisateur de le redéfinir (WCAG 1.4.12).',
    'L’espacement de ce texte est imposé (!important dans l’attribut style) : l’utilisateur ne peut pas l’adapter.',
    'Retirez !important des propriétés line-height, letter-spacing et word-spacing des styles en ligne.',
  ),

  // 11. Formulaires
  axe(
    'label',
    ['11.1'],
    'partial',
    'Test 11.1.1 : chaque champ doit avoir une étiquette ; la règle accepte aussi placeholder et ne vérifie pas la visibilité exigée par le test 11.1.3.',
    'Ce champ de formulaire n’a pas d’étiquette : on ne sait pas quoi y saisir.',
    'Associez une balise <label for="…"> au champ, ou ajoutez aria-labelledby vers un texte visible.',
  ),
  axe(
    'select-name',
    ['11.1'],
    'partial',
    'Test 11.1.1 : chaque liste de choix <select> doit avoir une étiquette ; la visibilité reste à vérifier.',
    'Cette liste déroulante n’a pas d’étiquette : on ne sait pas à quoi correspond le choix.',
    'Associez une balise <label for="…"> à la liste <select>.',
  ),
  axe(
    'aria-input-field-name',
    ['11.1'],
    'partial',
    'Test 11.1.1 : un champ de saisie ARIA (combobox, listbox, searchbox, slider, spinbutton, textbox) doit avoir une étiquette.',
    'Ce champ de saisie personnalisé n’a pas de nom accessible : on ne sait pas quoi y saisir.',
    'Ajoutez un attribut aria-labelledby pointant vers une étiquette visible, ou aria-label.',
  ),
  axe(
    'form-field-multiple-labels',
    ['11.2'],
    'partial',
    'Test 11.2.1 (indice axe) : plusieurs balises <label> pour un même champ rendent l’étiquette restituée imprévisible.',
    'Ce champ a plusieurs étiquettes : les lecteurs d’écran n’en annoncent parfois qu’une seule.',
    'Gardez une seule balise <label> par champ et regroupez les informations complémentaires avec aria-describedby.',
  ),
  axe(
    'button-name',
    ['11.9'],
    'partial',
    'Test 11.9.1 (indice axe) : un bouton sans intitulé ne peut pas avoir d’intitulé pertinent ; la pertinence reste à vérifier.',
    'Ce bouton n’a pas d’intitulé : un lecteur d’écran annonce seulement « bouton ».',
    'Ajoutez un texte au bouton, ou un attribut aria-label s’il ne contient qu’une icône.',
  ),
  axe(
    'input-button-name',
    ['11.9'],
    'partial',
    'Test 11.9.1 : un bouton <input> (submit, reset, button) sans valeur n’a pas d’intitulé.',
    'Ce bouton de formulaire n’a pas d’intitulé : son action n’est pas annoncée.',
    'Renseignez l’attribut value du bouton, par exemple value="Envoyer".',
  ),
  axe(
    'aria-command-name',
    ['11.9'],
    'partial',
    'Test 11.9.1 (indice axe) : un bouton, lien ou élément de menu ARIA sans nom accessible n’a pas d’intitulé.',
    'Ce bouton ou élément de menu personnalisé n’a pas de nom accessible : son action n’est pas annoncée.',
    'Ajoutez un texte à l’élément, ou un attribut aria-label ou aria-labelledby.',
  ),
  axe(
    'autocomplete-valid',
    ['11.13'],
    'partial',
    'Test 11.13.1 : la valeur de l’attribut autocomplete doit appartenir à la liste prévue ; sa présence et sa pertinence restent à vérifier.',
    'La valeur de l’attribut autocomplete de ce champ n’est pas reconnue : le remplissage automatique ne fonctionnera pas.',
    'Utilisez une valeur autocomplete normalisée, par exemple email, given-name ou postal-code.',
  ),

  // 12. Navigation
  axe(
    'bypass',
    ['12.6', '12.7'],
    'partial',
    'Tests 12.6.1 et 12.7.1 : l’échec de la règle signifie l’absence de lien d’évitement, de région et de titre, donc aucun moyen d’atteindre ou d’éviter les zones.',
    'La page n’offre aucun moyen d’aller directement au contenu principal : il faut parcourir toute la navigation au clavier.',
    'Ajoutez en début de page un lien « Aller au contenu » vers la balise <main>, et structurez la page avec des régions.',
  ),
  axe(
    'skip-link',
    ['12.7'],
    'partial',
    'Test 12.7.2 : le lien d’évitement doit être fonctionnel ; la règle vérifie que sa cible existe et peut recevoir le focus.',
    'Ce lien d’évitement pointe vers une cible inexistante ou non focalisable : il ne fonctionne pas.',
    'Faites pointer le lien vers l’id d’un élément existant, par exemple <main id="contenu">.',
  ),

  // 13. Consultation
  axe(
    'meta-refresh',
    ['13.1'],
    'partial',
    'Tests 13.1.1 et 13.1.2 : un rafraîchissement ou une redirection différée par balise <meta> n’est pas contrôlable ; les procédés par script ne sont pas vérifiés.',
    'Cette page se rafraîchit ou redirige automatiquement après un délai : vous risquez de perdre votre lecture.',
    'Supprimez le rafraîchissement automatique, ou faites une redirection immédiate côté serveur.',
  ),
  axe(
    'blink',
    ['13.8'],
    'partial',
    'Test 13.8.2 : la balise <blink> produit un clignotement non contrôlable ; les autres contenus clignotants ne sont pas vérifiés.',
    'Ce texte clignote sans possibilité de l’arrêter : il distrait et peut gêner la lecture.',
    'Supprimez la balise <blink>.',
  ),
  axe(
    'marquee',
    ['13.8'],
    'partial',
    'Test 13.8.1 : la balise <marquee> produit un mouvement non contrôlable ; les autres contenus en mouvement ne sont pas vérifiés.',
    'Ce texte défile sans possibilité de l’arrêter : il est difficile à lire.',
    'Supprimez la balise <marquee> ou proposez un bouton pour arrêter le défilement.',
  ),

  // Contrôles maison Balise (ids figés, implémentés dans packages/analyzer)
  balise(
    'balise-skip-link',
    ['12.7'],
    'partial',
    'Test 12.7.1 : un lien d’évitement vers le contenu principal doit être présent ; sa place, son ordre et sa visibilité au focus dans l’ensemble des pages (test 12.7.2) restent à vérifier.',
    'La page ne commence pas par un lien d’évitement vers le contenu principal : au clavier, il faut traverser tout l’en-tête.',
    'Ajoutez en tout début de page un lien « Aller au contenu » vers l’id de la balise <main>, visible au moins au focus.',
  ),
  balise(
    'balise-heading-hierarchy',
    ['9.1'],
    'partial',
    'Test 9.1.1 : une page sans titre de niveau 1 ou avec un saut de niveau a une hiérarchie de titres probablement non pertinente ; la pertinence des titres (9.1.2, 9.1.3) reste à vérifier.',
    'La hiérarchie des titres est incohérente (titre de niveau 1 absent ou niveau sauté) : la structure de la page est difficile à comprendre avec un lecteur d’écran.',
    'Commencez par un titre <h1> puis enchaînez les niveaux sans en sauter (h2 sous h1, h3 sous h2).',
  ),
  balise(
    'balise-page-lang',
    ['8.3', '8.4'],
    'partial',
    'Tests 8.3.1 et 8.4.1 : le contrôle échoue si la langue par défaut est absente (8.3) ou si son code est invalide (8.4) ; la pertinence du code reste à vérifier.',
    'La langue par défaut de la page est absente ou invalide : un lecteur d’écran risque de la lire avec une mauvaise prononciation.',
    'Indiquez un code de langue valide sur la balise <html>, par exemple <html lang="fr">.',
  ),
  balise(
    'balise-page-title',
    ['8.5'],
    'full',
    'Test 8.5.1 : chaque page doit avoir un titre de page (balise <title>) ; le contrôle vérifie sa présence et qu’il n’est pas vide. Sa pertinence (8.6) reste à vérifier manuellement.',
    'La page n’a pas de titre ou son titre est vide : on ne peut pas l’identifier dans les onglets ni à l’arrivée avec un lecteur d’écran.',
    'Ajoutez une balise <title> non vide décrivant le contenu de la page.',
  ),
];
