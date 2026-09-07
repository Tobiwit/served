import { normalizeCourse } from '@/lib/db/types';
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

/**
 * sessionStorage is empty on a cold open and on a PWA relaunch, and survives
 * navigation within the app — which is exactly the definition of "this launch".
 */
const LAUNCH_KEY = 'served.launch';

/** Memoised: React runs mount effects twice in development, and a launch is once. */
let launch: boolean | null = null;

function isNewLaunch(): boolean {
  if (launch !== null) return launch;
  try {
    launch = window.sessionStorage.getItem(LAUNCH_KEY) !== '1';
    window.sessionStorage.setItem(LAUNCH_KEY, '1');
  } catch {
    // private mode: without somewhere to record the launch, treat every read as a
    // continuation rather than resetting the filters mid-session
    launch = false;
  }
  return launch;
}

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
    // and so is a new launch: yesterday's mood is stale, but so is this morning's.
    // What you excluded and what you have already seen still belong to the run.
    const filters = isNewLaunch() ? defaultFilters() : { ...defaultFilters(), ...parsed.filters };
    // a session stored yesterday can still name a course that no longer exists
    filters.courses = [...new Set(filters.courses.map(normalizeCourse).filter((c) => c !== null))];
    return { ...emptySession(), ...parsed, filters };
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
