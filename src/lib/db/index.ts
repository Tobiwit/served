import { CloudRepo } from './cloud';

let repo: CloudRepo | null = null;

/**
 * One store, one instance. The mirror, the outbox and the sync loop all hang off it,
 * so a second copy would mean a second queue draining the same rows.
 */
export function getRepo(): CloudRepo {
  if (!repo) repo = new CloudRepo();
  return repo;
}

export { CloudRepo } from './cloud';
export type { Repo, SyncState } from './adapter';
export * from './types';
