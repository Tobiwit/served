import { append, bulkDel, getAll, putIfPresent, STORE } from './idb';

/**
 * Unsent work.
 *
 * Every write lands here in the same tick it lands in the mirror, so saving a recipe
 * is never something you wait for. The queue is drained in `seq` order and strictly
 * serially: two writes to one recipe that arrive out of order would leave the cloud
 * holding the older one.
 */

export type OutboxKind =
  | 'recipe.save'
  | 'recipe.delete'
  | 'ingredient.save'
  | 'ingredient.delete'
  | 'cook.log'
  | 'backlog.save'
  | 'backlog.delete'
  | 'food.save'
  | 'food.delete'
  | 'image.upload';

export interface OutboxEntry<T = unknown> {
  seq: number;
  kind: OutboxKind;
  /** the record this concerns — what repeat writes are folded together on */
  targetId: string;
  payload: T;
  /** key into the blobs store, for an image queued while offline */
  blobId?: string;
  state: 'pending' | 'failed';
  attempts: number;
  lastError: string | null;
  queuedAt: string;
}

/** A save carries the whole record, so an earlier one is pure waste. */
const COALESCING: OutboxKind[] = ['recipe.save', 'ingredient.save', 'backlog.save', 'food.save'];

/** Deleting supersedes anything still queued for that record. */
const SUPERSEDED_BY_DELETE: Record<string, OutboxKind[]> = {
  'recipe.delete': ['recipe.save', 'image.upload'],
  'ingredient.delete': ['ingredient.save'],
  'backlog.delete': ['backlog.save', 'image.upload'],
  'food.delete': ['food.save'],
};

type Listener = () => void;
const listeners = new Set<Listener>();

export function onOutboxChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function announce() {
  for (const fn of listeners) fn();
}

/** In `seq` order: an autoIncrement store hands rows back by key. */
export function listOutbox(): Promise<OutboxEntry[]> {
  return getAll<OutboxEntry>(STORE.outbox);
}

export async function counts(): Promise<{ pending: number; failed: number }> {
  const all = await listOutbox();
  return {
    pending: all.filter((e) => e.state === 'pending').length,
    failed: all.filter((e) => e.state === 'failed').length,
  };
}

export async function enqueue<T>(
  kind: OutboxKind,
  targetId: string,
  payload: T,
  blobId?: string,
): Promise<OutboxEntry<T>> {
  const existing = await listOutbox();

  // Folding only ever drops *pending* work. A parked failure is left alone: it is
  // something to look at, not something a later tap should quietly erase.
  const obsolete = existing.filter((e) => {
    if (e.state !== 'pending' || e.targetId !== targetId) return false;
    if (COALESCING.includes(kind) && e.kind === kind) return true;
    return (SUPERSEDED_BY_DELETE[kind] ?? []).includes(e.kind);
  });
  if (obsolete.length) await bulkDel(STORE.outbox, obsolete.map((e) => e.seq));

  const entry = {
    kind,
    targetId,
    payload,
    ...(blobId ? { blobId } : {}),
    state: 'pending' as const,
    attempts: 0,
    lastError: null,
    queuedAt: new Date().toISOString(),
  };
  const seq = await append(STORE.outbox, entry);
  announce();
  return { ...entry, seq };
}

/**
 * Rewrite the payloads of entries still waiting to go.
 *
 * Needed because a queued entry is a snapshot: a recipe saved with a photo the device
 * has not uploaded yet carries a placeholder URL, and by the time the upload resolves
 * that URL the save is already sitting in the queue holding the old one.
 */
export async function updatePending(
  kind: OutboxKind,
  targetId: string,
  update: (payload: unknown) => unknown,
): Promise<void> {
  const matches = (await listOutbox()).filter(
    (e) => e.state === 'pending' && e.kind === kind && e.targetId === targetId,
  );
  for (const entry of matches) {
    await putIfPresent<OutboxEntry>(STORE.outbox, entry.seq, (current) => ({
      ...current,
      payload: update(current.payload),
    }));
  }
}

export async function done(seq: number): Promise<void> {
  await bulkDel(STORE.outbox, [seq]);
  announce();
}

/**
 * A rejected write is either worth trying again or it never will be. Auth, timeouts,
 * rate limits and anything network-shaped come back. A row Postgres refused on its
 * merits is parked instead — retrying it forever would wedge everything behind it.
 *
 * Conditional on the entry still existing, and deliberately so. A flush holds an
 * entry in memory for as long as the request takes, and a save made in that window
 * folds it away; writing the failure back unguarded would put it straight back and
 * send the superseded version after all.
 */
export async function fail(entry: OutboxEntry, error: unknown, permanent: boolean): Promise<void> {
  await putIfPresent<OutboxEntry>(STORE.outbox, entry.seq, (current) => ({
    ...current,
    state: permanent ? 'failed' : 'pending',
    attempts: current.attempts + 1,
    lastError: describe(error),
  }));
  announce();
}

export async function retryFailed(): Promise<void> {
  const failed = (await listOutbox()).filter((e) => e.state === 'failed');
  for (const entry of failed) {
    await putIfPresent<OutboxEntry>(STORE.outbox, entry.seq, (current) => ({
      ...current,
      state: 'pending',
      attempts: 0,
      lastError: null,
    }));
  }
  announce();
}

export async function discardFailed(): Promise<void> {
  const failed = (await listOutbox()).filter((e) => e.state === 'failed');
  await bulkDel(STORE.outbox, failed.map((e) => e.seq));
  announce();
}

function describe(error: unknown): string {
  if (!error) return 'Unknown error';
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && 'message' in error) return String((error as { message: unknown }).message);
  return String(error);
}
