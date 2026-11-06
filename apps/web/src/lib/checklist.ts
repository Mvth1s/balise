import type { KeyValueStorage } from './storage';
import { browserStorage, readItem, writeItem } from './storage';

/** Manual-check list state, kept in the browser per report id. */
export const CHECKLIST_PREFIX = 'balise:checklist:';

export function checklistKey(reportId: string): string {
  return `${CHECKLIST_PREFIX}${reportId}`;
}

export function loadChecklist(
  reportId: string,
  storage: KeyValueStorage | null = browserStorage(),
): Set<string> {
  const raw = readItem(checklistKey(reportId), storage);
  if (!raw) return new Set();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v): v is string => typeof v === 'string'));
  } catch {
    return new Set();
  }
}

export function saveChecklist(
  reportId: string,
  checked: Iterable<string>,
  storage: KeyValueStorage | null = browserStorage(),
): boolean {
  return writeItem(checklistKey(reportId), JSON.stringify([...checked].sort()), storage);
}

export function toggleItem(checked: ReadonlySet<string>, id: string, on: boolean): Set<string> {
  const next = new Set(checked);
  if (on) next.add(id);
  else next.delete(id);
  return next;
}
