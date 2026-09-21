-- The backlog: meals to write down properly later.
--
-- A title, optionally a photo taken while it was still on the plate, and nothing
-- else. Deliberately not a row in `recipes` with the fields left empty — an
-- ingredient-less recipe would sit in the library scoring zero and turn up in
-- Explore as something to cook tonight.
--
-- Same shape as every other synced table: server-stamped `updated_at` for the pull
-- cursor, and a `deleted_at` tombstone so a delete reaches the other device rather
-- than the row simply reappearing on the next sync.

create table if not exists backlog (
  id         text primary key,
  title      text not null,
  note       text,
  image_url  text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists backlog_updated_at_idx on backlog (updated_at);
create index if not exists backlog_created_at_idx on backlog (created_at desc);

drop trigger if exists backlog_touch on backlog;
create trigger backlog_touch before insert or update on backlog
  for each row execute function touch_updated_at();

-- Same shape as 0001 and 0004: one private account, so any authenticated session
-- owns the data. Sign-ups are disabled in the dashboard, which is what makes that true.

alter table backlog enable row level security;

drop policy if exists backlog_authenticated_all on backlog;
create policy backlog_authenticated_all on backlog
  for all to authenticated using (true) with check (true);
