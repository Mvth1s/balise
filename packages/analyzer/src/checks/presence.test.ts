// @vitest-environment jsdom
/// <reference lib="dom" />
import { getReference } from '@balise/rgaa-mapping';
import { describe, expect, it } from 'vitest';
import { mapResults } from '../map-results.js';
import { detectPresence, mergePresence, sanitizePresence, type Presence } from './presence.js';

const page = (body: string): Document =>
  new DOMParser().parseFromString(`<!doctype html><html><body>${body}</body></html>`, 'text/html');

describe('detectPresence', () => {
  it('finds nothing on an empty text page', () => {
    const p = detectPresence(page('<p>Bonjour</p>'));
    expect(Object.values(p).every((v) => v === false)).toBe(true);
  });

  it('counts ARIA equivalents as present', () => {
    const p = detectPresence(
      page(
        '<div role="grid"></div><div role="textbox"></div><span role="link">x</span><div role="button">b</div><div role="img"></div>',
      ),
    );
    expect(p).toMatchObject({
      tables: true,
      fields: true,
      links: true,
      buttons: true,
      images: true,
    });
  });

  it('detects media (elements and players in frames), documents, RTL and cryptic text', () => {
    expect(detectPresence(page('<video></video>')).timedMedia).toBe(true);
    const yt = detectPresence(
      page('<iframe src="https://www.youtube-nocookie.com/embed/x"></iframe>'),
    );
    expect(yt).toMatchObject({ timedMedia: true, frames: true });
    expect(detectPresence(page('<object data="app.swf"></object>')).nonTimedMedia).toBe(true);
    expect(detectPresence(page('<a href="/r.PDF?v=2">Rapport</a>')).officeDocs).toBe(true);
    expect(detectPresence(page('<p>שלום</p>')).rtlText).toBe(true);
    expect(detectPresence(page('<p>Merci :-)</p>')).crypticText).toBe(true);
    expect(detectPresence(page('<p>Bravo 🎉</p>')).crypticText).toBe(true);
    expect(detectPresence(page('<script>const x = "🎉"</script><p>ok</p>')).crypticText).toBe(
      false,
    );
    expect(detectPresence(page('<p onclick="go()">x</p>')).scripts).toBe(true);
    expect(detectPresence(page('<script type="application/ld+json">{}</script>')).scripts).toBe(
      false,
    );
  });

  it('looks inside open shadow roots', () => {
    const doc = page('<div id="host"></div>');
    doc.getElementById('host')!.attachShadow({ mode: 'open' }).innerHTML = '<table></table>';
    expect(detectPresence(doc).tables).toBe(true);
  });

  it('merges frames and rejects malformed values', () => {
    const none = detectPresence(page(''));
    expect(mergePresence([none, { ...none, tables: true }]).tables).toBe(true);
    expect(sanitizePresence({ tables: 'yes' })).toBeNull();
    expect(sanitizePresence(none)).toEqual(none);
  });
});

describe('mapResults with presence', () => {
  const ref = getReference();
  const none = detectPresence(page('')) as Presence;

  it('marks criteria whose element kinds are absent as not applicable, with the reason', () => {
    const criteria = mapResults(ref, [], { ...none, images: true, links: true });
    const byId = new Map(criteria.map((c) => [c.id, c]));
    expect(byId.get('5.6')).toMatchObject({ status: 'non-applicable', absent: ['tableau'] });
    expect(byId.get('4.13')?.absent).toEqual([
      'média temporel (vidéo, audio)',
      'média non temporel (object, embed)',
    ]);
    expect(byId.get('1.1')?.status).toBe('a-verifier'); // images present
    expect(byId.get('3.2')?.status).toBe('a-verifier'); // always applies
    expect(mapResults(ref, [], null).find((c) => c.id === '5.6')?.status).toBe('a-verifier');
  });

  it('never hides a detected failure', () => {
    const failing = [
      {
        rule: 'th-has-data-cells',
        engine: 'axe' as const,
        outcome: 'fail' as const,
        failures: [{ selector: 't', html: '<table>' }],
        passedCount: 0,
      },
    ];
    const c = mapResults(ref, failing, none).find((x) => x.id === '5.7');
    expect(c?.status).toBe('non-conforme');
    expect(c?.absent).toBeUndefined();
  });
});
