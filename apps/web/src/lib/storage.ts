/**
 * localStorage access that never throws (private mode, blocked storage, SSR).
 */

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function browserStorage(): KeyValueStorage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readItem(key: string, storage = browserStorage()): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeItem(key: string, value: string, storage = browserStorage()): boolean {
  try {
    if (!storage) return false;
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeItem(key: string, storage = browserStorage()): void {
  try {
    storage?.removeItem(key);
  } catch {
    /* ignore */
  }
}
