/** French formatting helpers (pure, locale fixed to fr-FR). */

const dateTime = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Paris',
});

const longDate = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/Paris',
});

/** "05/11/2026 à 14:32" */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const parts = dateTime.formatToParts(d);
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('day')}/${get('month')}/${get('year')} à ${get('hour')}:${get('minute')}`;
}

/** "5 novembre 2026" (accepts "2026-11-05"). */
export function formatLongDate(isoDate: string): string {
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(isoDate) ? `${isoDate}T12:00:00Z` : isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  return longDate.format(d);
}

/** Adds days to an ISO date and returns the "jj/mm/aaaa" date. */
export function formatExpiry(iso: string, days: number): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  d.setUTCDate(d.getUTCDate() + days);
  return formatDateTime(d.toISOString()).split(' à ')[0] ?? '';
}

/** "1 critère" / "3 critères" */
export function pluralize(n: number, one: string, many: string): string {
  return `${n} ${n > 1 ? many : one}`;
}

/** "12 secondes" / "1 minute" / "3 minutes" */
export function formatDelay(seconds: number): string {
  if (seconds < 60) return pluralize(Math.max(1, Math.round(seconds)), 'seconde', 'secondes');
  return pluralize(Math.ceil(seconds / 60), 'minute', 'minutes');
}

/** Removes the scheme and trailing slash for compact display. */
export function shortUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}
