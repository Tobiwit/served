/**
 * Preferences that belong to this device, not to the collection.
 *
 * Nothing here is worth a column, a migration or a sync: they are ways of *looking*
 * at the data rather than part of it, so they live in localStorage and stay on the
 * phone that set them.
 */

export interface Prefs {
  /** show only the recipes I added, hiding the starter collection */
  hideSeeded: boolean;
}

const KEY = 'served.prefs.v1';

export function defaultPrefs(): Prefs {
  return { hideSeeded: false };
}

export function loadPrefs(): Prefs {
  if (typeof window === 'undefined') return defaultPrefs();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaultPrefs();
    return { ...defaultPrefs(), ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch {
    return defaultPrefs();
  }
}

export function savePrefs(prefs: Prefs) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* private mode — the preference simply does not stick */
  }
}
