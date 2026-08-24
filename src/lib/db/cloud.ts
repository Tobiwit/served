import type {
  CookLogEntry,
  Ingredient,
  NewCookLogEntry,
  NewIngredient,
  NewRecipe,
  Recipe,
} from './types';
import { newId, type Repo, type SyncState } from './adapter';
import { mapCookLog, mapIngredient, mapRecipe } from './map';
import { SupabaseRemote, supabaseClient } from './supabase';
import {
  bulkDel,
  bulkPut,
  clearMirror,
  del,
  get,
  getAll,
  getMeta,
  put,
  setMeta,
  STORE,
} from './idb';
import {
  counts,
  done,
  enqueue,
  fail,
  listOutbox,
  onOutboxChange,
  updatePending,
  type OutboxEntry,
} from './outbox';

/**
 * Local-first repository.
 *
 * Reads come off the device mirror and never touch the network. Writes land in the
 * mirror and in the outbox in the same tick, then drain to Supabase whenever there
 * is a connection. The app therefore behaves identically on the U-Bahn and at home;
 * only the sync readout in Settings can tell the difference.
 *
 * Conflict handling is last-write-wins per record, which is the honest resolution
 * for one person on one or two devices. The one rule that matters is below in
 * `applyPull`: a pulled row never overwrites a local edit that has not been sent.
 */

export const IMAGE_BUCKET = 'recipe-images';

/** A cursor of zero means "everything". */
const EPOCH = '1970-01-01T00:00:00Z';

const CURSOR = {
  recipes: 'sync.cursor.recipes',
  ingredients: 'sync.cursor.ingredients',
  cookLog: 'sync.cursor.cook_log',
} as const;

const LAST_SYNCED = 'sync.lastSyncedAt';

/**
 * A row committed by a transaction that started before our snapshot can carry a
 * timestamp older than the newest row we just read, and would then sit forever on
 * the wrong side of the cursor. Re-asking for a few seconds of overlap costs one
 * redundant page and closes the hole; applying a row twice is a no-op.
 */
const OVERLAP_MS = 10_000;

type Listener = () => void;

export class CloudRepo implements Repo {
  private remote: SupabaseRemote | null;
  private flushing: Promise<void> | null = null;
  private pulling: Promise<void> | null = null;
  private listeners = new Set<Listener>();
  private state: SyncState = {
    phase: 'idle',
    pending: 0,
    failed: 0,
    lastSyncedAt: null,
    error: null,
  };

  constructor() {
    const db = supabaseClient();
    this.remote = db ? new SupabaseRemote(db) : null;
    onOutboxChange(() => void this.refreshCounts());
  }

  /* ------------------------------------------------------------------- reads */

  async listRecipes(): Promise<Recipe[]> {
    const all = await getAll<Recipe>(STORE.recipes);
    return all.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }

  async listIngredients(): Promise<Ingredient[]> {
    const all = await getAll<Ingredient>(STORE.ingredients);
    return all.sort((a, b) => a.name.localeCompare(b.name));
  }

  async listCookLog(): Promise<CookLogEntry[]> {
    const all = await getAll<CookLogEntry>(STORE.cookLog);
    return all.sort((a, b) => (a.cooked_at < b.cooked_at ? 1 : -1));
  }

  /* ------------------------------------------------------------------ writes */

  async saveRecipe(recipe: NewRecipe): Promise<Recipe> {
    const id = recipe.id ?? newId('rec');
    const existing = await get<Recipe>(STORE.recipes, id);
    const now = new Date().toISOString();

    const saved = withStableIds({
      ...(recipe as Recipe),
      id,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    });

    await put(STORE.recipes, saved);
    await enqueue('recipe.save', id, saved);
    void this.flush();
    return saved;
  }

  async deleteRecipe(id: string): Promise<void> {
    await del(STORE.recipes, id);
    await enqueue('recipe.delete', id, null);
    void this.flush();
  }

  async saveIngredient(ingredient: NewIngredient): Promise<Ingredient> {
    const id = ingredient.id ?? newId('ing');
    const existing = await get<Ingredient>(STORE.ingredients, id);
    const now = new Date().toISOString();

    const saved: Ingredient = {
      ...(ingredient as Ingredient),
      id,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    };

    await put(STORE.ingredients, saved);
    await enqueue('ingredient.save', id, saved);
    void this.flush();
    return saved;
  }

  async deleteIngredient(id: string): Promise<void> {
    await del(STORE.ingredients, id);
    await enqueue('ingredient.delete', id, null);
    void this.flush();
  }

  async logCooked(entry: NewCookLogEntry): Promise<CookLogEntry> {
    const id = entry.id ?? newId('cook');
    const now = new Date().toISOString();
    const saved: CookLogEntry = {
      ...entry,
      id,
      cooked_at: entry.cooked_at ?? now,
      note: entry.note ?? null,
      created_at: now,
      updated_at: now,
    };

    await put(STORE.cookLog, saved);
    await enqueue('cook.log', id, saved);
    void this.flush();
    return saved;
  }

  /* ------------------------------------------------------------------ images */

  /**
   * Online this uploads and hands back a public URL. Offline the blob is parked in
   * the mirror and the recipe carries an `idb:` sentinel until the queue drains,
   * so the photo you just took shows up immediately either way.
   */
  async storeImage(recipeId: string, blob: Blob): Promise<string> {
    const path = `${recipeId}-${Date.now()}.jpg`;

    if (this.remote && isOnline()) {
      try {
        return await this.remote.uploadImage(IMAGE_BUCKET, path, blob);
      } catch {
        /* fall through and queue it */
      }
    }

    const blobId = newId('img');
    await put(STORE.blobs, { id: blobId, blob });
    await enqueue('image.upload', recipeId, { path }, blobId);
    void this.flush();
    return `idb:${blobId}`;
  }

  async readBlob(blobId: string): Promise<Blob | null> {
    const row = await get<{ id: string; blob: Blob }>(STORE.blobs, blobId);
    return row?.blob ?? null;
  }

  async removeImage(imageUrl: string | null): Promise<void> {
    if (!imageUrl) return;
    if (imageUrl.startsWith('idb:')) {
      await del(STORE.blobs, imageUrl.slice(4));
      return;
    }
    if (imageUrl.startsWith('data:') || !this.remote) return;
    const marker = `/${IMAGE_BUCKET}/`;
    const i = imageUrl.indexOf(marker);
    if (i === -1) return;
    // best effort — a missing remote object is not worth surfacing
    try {
      await this.remote.removeImage(IMAGE_BUCKET, imageUrl.slice(i + marker.length));
    } catch {
      /* ignore */
    }
  }

  /* -------------------------------------------------------------------- sync */

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  syncState(): SyncState {
    return this.state;
  }

  get configured(): boolean {
    return this.remote !== null;
  }

  private emit(patch: Partial<SyncState>) {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn();
  }

  private async refreshCounts() {
    const { pending, failed } = await counts();
    this.emit({ pending, failed });
  }

  /** Drain the queue, then pull. In that order: our own writes should not lose to
   *  a version of the row we are about to replace anyway. */
  async sync(): Promise<void> {
    await this.flush();
    await this.pull();
  }

  async pull(): Promise<void> {
    if (this.pulling) return this.pulling;
    this.pulling = this.runPull().finally(() => {
      this.pulling = null;
    });
    return this.pulling;
  }

  private async runPull(): Promise<void> {
    const remote = this.remote;
    if (!remote) return;
    if (!isOnline()) {
      this.emit({ phase: 'offline' });
      return;
    }

    this.emit({ phase: 'syncing', error: null });
    try {
      const [recipeCursor, ingredientCursor, cookCursor] = await Promise.all([
        getMeta<string>(CURSOR.recipes, EPOCH),
        getMeta<string>(CURSOR.ingredients, EPOCH),
        getMeta<string>(CURSOR.cookLog, EPOCH),
      ]);

      const [recipeRows, ingredientRows, cookRows] = await Promise.all([
        remote.pullRecipes(overlap(recipeCursor)),
        remote.pullIngredients(overlap(ingredientCursor)),
        remote.pullCookLog(overlap(cookCursor)),
      ]);

      // an unsent local edit outranks anything the pull brings back for that record
      const held = new Set(
        (await listOutbox()).filter((e) => e.state === 'pending').map((e) => e.targetId),
      );

      await Promise.all([
        this.applyPull(STORE.recipes, recipeRows, mapRecipe, held, CURSOR.recipes, recipeCursor),
        this.applyPull(
          STORE.ingredients,
          ingredientRows,
          mapIngredient,
          held,
          CURSOR.ingredients,
          ingredientCursor,
        ),
        this.applyPull(STORE.cookLog, cookRows, mapCookLog, held, CURSOR.cookLog, cookCursor),
      ]);

      const at = new Date().toISOString();
      await setMeta(LAST_SYNCED, at);
      this.emit({ phase: 'idle', lastSyncedAt: at, error: null });
    } catch (error) {
      this.emit({ phase: 'error', error: message(error) });
    }
  }

  private async applyPull<T extends { id: string }>(
    store: (typeof STORE)[keyof typeof STORE],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rows: any[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map: (row: any) => T,
    held: Set<string>,
    cursorKey: string,
    cursor: string,
  ): Promise<void> {
    if (!rows.length) return;

    const live: T[] = [];
    const tombstones: string[] = [];
    let newest = cursor;

    for (const row of rows) {
      if (row.updated_at > newest) newest = row.updated_at;
      if (held.has(row.id)) continue;
      if (row.deleted_at) tombstones.push(row.id);
      else live.push(map(row));
    }

    await bulkPut(store, live);
    await bulkDel(store, tombstones);
    await setMeta(cursorKey, newest);
  }

  /** Throw away the mirror and pull the whole collection down again. */
  async refreshFromCloud(): Promise<void> {
    await clearMirror();
    this.emit({ lastSyncedAt: null });
    await this.pull();
  }

  /* ------------------------------------------------------------------- flush */

  flush(): Promise<void> {
    if (this.flushing) return this.flushing;
    this.flushing = this.drain().finally(() => {
      this.flushing = null;
    });
    return this.flushing;
  }

  private async drain(): Promise<void> {
    const remote = this.remote;
    if (!remote) return;
    if (!isOnline()) {
      this.emit({ phase: 'offline' });
      await this.refreshCounts();
      return;
    }

    for (;;) {
      const pending = (await listOutbox()).filter((e) => e.state === 'pending');
      await this.refreshCounts();
      if (!pending.length) {
        if (this.state.phase === 'offline') this.emit({ phase: 'idle' });
        return;
      }

      const entry = pending[0];
      try {
        await this.send(remote, entry);
        await done(entry.seq);
      } catch (error) {
        const permanent = isPermanent(error);
        await fail(entry, error, permanent);
        this.emit({ phase: permanent ? 'error' : 'offline', error: message(error) });
        // a transient failure means the next entry will fail too; a parked one is
        // out of the queue, so the loop can carry on past it
        if (!permanent) return;
      }
    }
  }

  private async send(remote: SupabaseRemote, entry: OutboxEntry): Promise<void> {
    switch (entry.kind) {
      case 'recipe.save':
        return remote.saveRecipe(entry.payload as Recipe);
      case 'recipe.delete':
        return remote.deleteRecipe(entry.targetId);
      case 'ingredient.save':
        return remote.saveIngredient(entry.payload as Ingredient);
      case 'ingredient.delete':
        return remote.deleteIngredient(entry.targetId);
      case 'cook.log':
        return remote.saveCookEntry(entry.payload as CookLogEntry);
      case 'image.upload':
        return this.sendImage(remote, entry);
    }
  }

  /**
   * Uploading the blob is only half the job. Three places can still be holding the
   * `idb:` placeholder that stood in for this photo, and all three have to be told:
   *
   *   - the mirror, so the recipe on screen points at the real file;
   *   - a recipe save still sitting in the queue, whose payload was snapshotted with
   *     the placeholder in it — this entry is queued first, so that save has *not*
   *     gone out yet and would otherwise write the placeholder to the cloud for good;
   *   - the cloud row, for the reverse order, where the save went out before the
   *     photo could be uploaded.
   */
  private async sendImage(remote: SupabaseRemote, entry: OutboxEntry): Promise<void> {
    const { path } = entry.payload as { path: string };
    const blob = entry.blobId ? await this.readBlob(entry.blobId) : null;
    if (!blob) return; // the photo was replaced or removed before we got here

    const url = await remote.uploadImage(IMAGE_BUCKET, path, blob);
    const sentinel = `idb:${entry.blobId}`;

    const recipe = await get<Recipe>(STORE.recipes, entry.targetId);
    if (recipe && recipe.image_url === sentinel) {
      await put(STORE.recipes, { ...recipe, image_url: url });
    }

    await updatePending('recipe.save', entry.targetId, (payload) => {
      const queued = payload as Recipe;
      return queued?.image_url === sentinel ? { ...queued, image_url: url } : queued;
    });

    await remote.setRecipeImage(entry.targetId, url, sentinel);
    if (entry.blobId) await del(STORE.blobs, entry.blobId);
  }
}

/* --------------------------------------------------------------------- helpers */

function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

function overlap(cursor: string): string {
  if (cursor === EPOCH) return cursor;
  return new Date(Date.parse(cursor) - OVERLAP_MS).toISOString();
}

/**
 * Children are given their ids here rather than on the way out, so the copy in the
 * mirror and the copy in Postgres are the same record. Without it every save would
 * change the keys the list is rendered from on the next pull.
 */
function withStableIds(recipe: Recipe): Recipe {
  return {
    ...recipe,
    ingredients: recipe.ingredients.map((ri, i) => ({
      ...ri,
      id: ri.id || newId('ri'),
      sort_order: i,
      substitutions: ri.substitutions.map((s) => ({ ...s, id: s.id || newId('sub') })),
    })),
    instructions: recipe.instructions.map((s, i) => ({
      ...s,
      id: s.id || newId('st'),
      step_number: i + 1,
    })),
  };
}

/**
 * Worth trying again, or never? Anything network-shaped, an expired session, a
 * timeout or a rate limit comes back round. A row Postgres rejected on its merits
 * is parked instead — retrying that forever would wedge everything behind it.
 */
function isPermanent(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { status?: number; code?: string };

  if (typeof e.status === 'number') {
    if ([401, 403, 408, 429].includes(e.status)) return false;
    if (e.status >= 400 && e.status < 500) return true;
    return false;
  }

  // PostgREST hands back a SQLSTATE. Classes 22 (data exception) and 23 (integrity
  // violation) are the app's fault and will fail identically next time.
  if (typeof e.code === 'string' && /^(22|23)/.test(e.code)) return true;
  return false;
}

function message(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'Sync failed';
}
