// @vitest-environment jsdom
/// <reference lib="dom" />
import { describe, expect, it } from 'vitest';
import {
  checkDataTableHeaders,
  checkDecorativeImages,
  checkDirValid,
  checkDoctype,
  checkDuplicateId,
  checkEmptyParagraphs,
  checkFieldLabels,
  checkGenericLinks,
  checkGroupLegends,
  checkImageAltRelevant,
  checkLayoutTable,
  checkPresentationMarkup,
  checkRadioGroups,
  checkTitleRelevant,
  runCheckOnDocument,
  type CheckFn,
} from './index.js';

function outcome(fn: CheckFn, body: string, title = 'Programme – Médiathèque'): string {
  const doc = new DOMParser().parseFromString(
    `<!doctype html><html lang="fr"><head><title>${title}</title></head><body>${body}</body></html>`,
    'text/html',
  );
  return runCheckOnDocument(fn, doc).outcome;
}

describe('error-detection checks', () => {
  const cases: Array<[string, CheckFn, string, string, string?]> = [
    // [name, check, failing body, passing body, inapplicable body]
    ['duplicate id', checkDuplicateId, '<p id="a"></p><p id="a"></p>', '<p id="a"></p>', '<p></p>'],
    [
      'presentation',
      checkPresentationMarkup,
      '<center>x</center><p align="left">y</p>',
      '<p>x</p><img width="2">',
    ],
    ['dir', checkDirValid, '<p dir="right">x</p>', '<p dir="rtl">x</p>', '<p>x</p>'],
    [
      'generic link',
      checkGenericLinks,
      '<div><a href="/a">En savoir plus</a></div>',
      '<p>Le programme des ateliers : <a href="/a">en savoir plus</a></p>',
      '<p>x</p>',
    ],
    [
      'data table',
      checkDataTableHeaders,
      '<table><caption>T</caption><tr><td>a</td></tr></table>',
      '<table><caption>T</caption><tr><th>a</th></tr></table>',
      '<table><tr><td>a</td></tr></table>',
    ],
    [
      'layout table',
      checkLayoutTable,
      '<table role="presentation"><tr><th>a</th></tr></table>',
      '<table role="presentation"><tr><td>a</td></tr></table>',
      '<p></p>',
    ],
    [
      'decorative img',
      checkDecorativeImages,
      '<img alt="" title="Logo">',
      '<img alt="">',
      '<img alt="Chat">',
    ],
    [
      'alt relevant',
      checkImageAltRelevant,
      '<img alt="photo_12.jpg"><a href="/"><img alt=""></a>',
      '<img alt="Deux enfants lisent">',
      '<p></p>',
    ],
    [
      'field label',
      checkFieldLabels,
      '<input placeholder="E-mail">',
      '<label for="e">E-mail</label><input id="e">',
      '<input type="hidden">',
    ],
    [
      'radio group',
      checkRadioGroups,
      '<input type="radio" name="a"><input type="radio" name="a">',
      '<fieldset><legend>L</legend><input type="radio" name="a"><input type="radio" name="a"></fieldset>',
      '<input type="radio" name="a">',
    ],
    [
      'group legend',
      checkGroupLegends,
      '<fieldset><input></fieldset>',
      '<fieldset><legend>L</legend></fieldset>',
      '<p></p>',
    ],
    [
      'empty paragraph',
      checkEmptyParagraphs,
      '<p>&nbsp;</p><p><br></p>',
      '<p>x</p>',
      '<div></div>',
    ],
  ];
  it.each(cases)('%s', (_name, fn, failing, passing, inapplicable) => {
    expect(outcome(fn, failing)).toBe('fail');
    expect(outcome(fn, passing)).toBe('pass');
    if (inapplicable) expect(outcome(fn, inapplicable)).toBe('inapplicable');
  });

  it('flags generic page titles and file names', () => {
    expect(outcome(checkTitleRelevant, '', 'Sans titre')).toBe('fail');
    expect(outcome(checkTitleRelevant, '', 'index.html')).toBe('fail');
    expect(outcome(checkTitleRelevant, '', 'Horaires – Médiathèque')).toBe('pass');
  });

  it('requires an HTML doctype', () => {
    expect(outcome(checkDoctype, '')).toBe('pass');
    const quirks = new DOMParser().parseFromString('<html><body></body></html>', 'text/html');
    expect(runCheckOnDocument(checkDoctype, quirks).outcome).toBe('fail');
  });
});
