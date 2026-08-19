import type { FilterState } from './filters';
import { defaultFilters } from './filters';

/**
 * An Explore Run is deliberately temporary. It holds what I want *today* and
 * nothing else: no preference profile, no learning, no history. It resets on a
 * new calendar day, and can be reset by hand.
 */
export interface ExploreSession {
  date: string;
  filters: FilterState;
  excluded: string[];
  boosted: string[];
  seen: string[];
  /** the recipe currently on screen, so returning from detail keeps your place */
  current: string | null;
  started: boolean;
}

const KEY = 'served.explore.v1';

export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function emptySession(): ExploreSession {
  return { date: today(), filters: defaultFilters(), excluded: [], boosted: [], seen: [], current: null, started: false };
}

export function loadSession(): ExploreSession {
  if (typeof window === 'undefined') return emptySession();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return emptySession();
    const parsed = JSON.parse(raw) as ExploreSession;
    // a new day is a new mood
    if (parsed.date !== today()) return emptySession();
    return { ...emptySession(), ...parsed, filters: { ...defaultFilters(), ...parsed.filters } };
  } catch {
    return emptySession();
  }
}

export function saveSession(session: ExploreSession) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    /* non-fatal */
  }
}

export function clearSession() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(KEY);
}
