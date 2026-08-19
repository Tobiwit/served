import { LocalRepo } from './local';
import { SupabaseRepo, supabaseClient } from './supabase';
import type { Repo } from './adapter';

let repo: Repo | null = null;

/** Supabase when configured, the seeded local store otherwise. */
export function getRepo(): Repo {
  if (!repo) {
    const db = supabaseClient();
    repo = db ? new SupabaseRepo(db) : new LocalRepo();
  }
  return repo;
}

export type { Repo } from './adapter';
export * from './types';
