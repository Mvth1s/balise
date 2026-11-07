/**
 * Reliability set of the AI layer: small pages with the verdict an auditor
 * expects for each judged criterion. Used by scripts/ai-eval.ts.
 */
export interface EvalPage {
  path: string;
  title: string;
  body: string;
  lang?: string;
  /** Expected verdict per criterion. */
  expected: Record<string, 'conforme' | 'non-conforme'>;
}

const IMG = (fill: string, text = '') =>
  `data:image/svg+xml;base64,${Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120"><rect width="240" height="120" fill="${fill}"/>${text ? `<text x="20" y="70" font-size="28" font-family="sans-serif" fill="#000">${text}</text>` : '<circle cx="120" cy="60" r="40" fill="#fff"/>'}</svg>`,
  ).toString('base64')}`;

export const EVAL_PAGES: EvalPage[] = [
  {
    path: '/titre-ok',
    title: 'Horaires d’ouverture – Médiathèque des Tilleuls',
    body: '<h1>Horaires d’ouverture</h1><p>Du mardi au samedi, de 10 h à 18 h.</p>',
    expected: { '8.6': 'conforme', '9.1': 'conforme' },
  },
  {
    path: '/titre-ko',
    title: 'Page 2',
    body: '<h1>Horaires d’ouverture</h1><p>Du mardi au samedi, de 10 h à 18 h.</p>',
    expected: { '8.6': 'non-conforme' },
  },
  {
    path: '/liens-ok',
    title: 'Actualités – Mairie de Valbonne',
    body: '<h1>Actualités</h1><ul><li><a href="/travaux">Travaux de la rue des Lilas : calendrier</a></li><li><a href="/marche">Le marché de Noël ouvre le 1er décembre</a></li></ul>',
    expected: { '6.1': 'conforme' },
  },
  {
    path: '/liens-ko',
    title: 'Actualités – Mairie de Valbonne',
    body: '<h1>Actualités</h1><div><a href="/travaux">Cliquez ici</a></div><div><a href="/marche">Lire la suite</a></div>',
    expected: { '6.1': 'non-conforme' },
  },
  {
    path: '/langue-ok',
    title: 'Citation du jour – Bibliothèque',
    body: '<h1>Citation du jour</h1><p>Comme l’écrivait l’auteur : <q lang="en">The only way out is through, and it is a long road.</q></p>',
    expected: { '8.7': 'conforme' },
  },
  {
    path: '/langue-ko',
    title: 'Citation du jour – Bibliothèque',
    body: '<h1>Citation du jour</h1><p>Comme l’écrivait l’auteur : The only way out is through, and every road that leads there is long and hard.</p>',
    expected: { '8.7': 'non-conforme' },
  },
  {
    path: '/titres-ko',
    title: 'Inscription – Club de tennis',
    body: '<h1>Bienvenue</h1><h2>Section</h2><p>Tarifs annuels : 120 euros pour les adultes.</p><h2>Texte</h2><p>Les cours ont lieu le samedi matin.</p>',
    expected: { '9.1': 'non-conforme' },
  },
  {
    path: '/champs-ok',
    title: 'Contact – Club de tennis',
    body: '<h1>Contact</h1><form><label for="n">Nom</label><input id="n" autocomplete="name"><label for="e">Adresse électronique</label><input id="e" type="email" autocomplete="email"><button>Envoyer le message</button></form>',
    expected: { '11.2': 'conforme', '11.9': 'conforme' },
  },
  {
    path: '/champs-ko',
    title: 'Contact – Club de tennis',
    body: '<h1>Contact</h1><form><label for="n">Champ 1</label><input id="n"><label for="e">Champ 2</label><input id="e" type="email"><button>OK</button></form>',
    expected: { '11.2': 'non-conforme', '11.9': 'non-conforme' },
  },
  {
    path: '/images-ok',
    title: 'Résultats – Club de tennis',
    body: `<h1>Résultats</h1><figure><img src="${IMG('#2a7', 'Victoire 3-1')}" alt="Score final : victoire 3 à 1" width="240" height="120"><figcaption>Match du 4 novembre</figcaption></figure>`,
    expected: { '1.3': 'conforme' },
  },
  {
    path: '/images-ko',
    title: 'Résultats – Club de tennis',
    body: `<h1>Résultats</h1><p><img src="${IMG('#2a7', 'Victoire 3-1')}" alt="image" width="240" height="120"></p>`,
    expected: { '1.3': 'non-conforme', '1.8': 'non-conforme' },
  },
  {
    path: '/deco-ko',
    title: 'Résultats – Club de tennis',
    body: `<h1>Résultats</h1><p><img src="${IMG('#fd0', 'Inscriptions fermées le 30/11')}" alt="" width="240" height="120"></p>`,
    expected: { '1.2': 'non-conforme' },
  },
];
