-- The tracker: what was eaten, and what was done to earn room for it.
--
-- One row per logged meal or activity. Totals are stored rather than derived from
-- the ingredients table, because correcting an ingredient next month must not
-- rewrite what was counted today; `items` keeps the working.
--
-- `day` is the local calendar day the entry counts towards, written by the device
-- that logged it — the server's idea of midnight is UTC and wrong for the person.
--
-- Same shape as every other synced table: server-stamped `updated_at` for the pull
-- cursor, and a `deleted_at` tombstone so a delete reaches the other device.

create table if not exists food_log (
  id         text primary key,
  day        date not null,
  kind       text not null check (kind in ('food', 'activity')),
  slot       text check (slot in ('breakfast', 'coffee', 'lunch', 'snack', 'dinner', 'postgym')),
  label      text not null,
  kcal       numeric not null,
  protein    numeric,
  carbs      numeric,
  fat        numeric,
  source     text not null,
  recipe_id  text,
  servings   numeric,
  items      jsonb not null default '[]'::jsonb,
  logged_at  timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists food_log_updated_at_idx on food_log (updated_at);
create index if not exists food_log_day_idx on food_log (day desc);

drop trigger if exists food_log_touch on food_log;
create trigger food_log_touch before insert or update on food_log
  for each row execute function touch_updated_at();

alter table food_log enable row level security;

drop policy if exists food_log_authenticated_all on food_log;
create policy food_log_authenticated_all on food_log
  for all to authenticated using (true) with check (true);
