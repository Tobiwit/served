-- Sync. Three changes that a local mirror cannot work without.
--
-- 1. Tombstones. A hard delete is invisible to a delta pull: the row is simply
--    absent, which is indistinguishable from "not changed since you last asked".
--    Deleting therefore becomes an update, and the mirror drops what it sees
--    carrying a deleted_at.
--
-- 2. Parent touch. `recipes_touch` only fires on `recipes` itself, so editing a
--    recipe's ingredients moved nothing the pull can see and the change stayed on
--    the device that made it. Every child table now touches its recipe.
--
-- 3. Server time. updated_at is the sync cursor, so it has to come from one clock.
--    A phone that is three minutes fast writes rows the next pull will never ask
--    for. now() wins on insert as well as update, and the client stops sending it.

-- ------------------------------------------------------------------ tombstones

alter table recipes     add column if not exists deleted_at timestamptz;
alter table ingredients add column if not exists deleted_at timestamptz;

-- ------------------------------------------------------------------ cook log
-- Rotation history. Append-only in practice: one row per time a recipe was made.

create table if not exists cook_log (
  id         text primary key,
  recipe_id  text not null references recipes (id) on delete cascade,
  cooked_at  timestamptz not null default now(),
  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists cook_log_recipe_idx    on cook_log (recipe_id, cooked_at desc);
create index if not exists cook_log_cooked_at_idx on cook_log (cooked_at desc);

-- --------------------------------------------------------------- sync cursors
-- Every delta pull is `where updated_at > $since order by updated_at`.

create index if not exists recipes_updated_at_idx     on recipes (updated_at);
create index if not exists ingredients_updated_at_idx on ingredients (updated_at);
create index if not exists cook_log_updated_at_idx    on cook_log (updated_at);

-- ----------------------------------------------------------------- server time

create or replace function touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists recipes_touch     on recipes;
drop trigger if exists ingredients_touch on ingredients;

create trigger recipes_touch before insert or update on recipes
  for each row execute function touch_updated_at();

create trigger ingredients_touch before insert or update on ingredients
  for each row execute function touch_updated_at();

create trigger cook_log_touch before insert or update on cook_log
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------- parent touch

create or replace function touch_parent_recipe() returns trigger as $$
begin
  update recipes set updated_at = now()
   where id = coalesce(new.recipe_id, old.recipe_id);
  return null;
end;
$$ language plpgsql;

-- substitutions hang off a recipe_ingredient, so the recipe is one hop further out
create or replace function touch_grandparent_recipe() returns trigger as $$
begin
  update recipes set updated_at = now()
   where id = (
     select recipe_id from recipe_ingredients
      where id = coalesce(new.recipe_ingredient_id, old.recipe_ingredient_id)
   );
  return null;
end;
$$ language plpgsql;

drop trigger if exists recipe_ingredients_touch_parent  on recipe_ingredients;
drop trigger if exists recipe_instructions_touch_parent on recipe_instructions;
drop trigger if exists recipe_tags_touch_parent         on recipe_tags;
drop trigger if exists substitutions_touch_parent       on ingredient_substitutions;

create trigger recipe_ingredients_touch_parent
  after insert or update or delete on recipe_ingredients
  for each row execute function touch_parent_recipe();

create trigger recipe_instructions_touch_parent
  after insert or update or delete on recipe_instructions
  for each row execute function touch_parent_recipe();

create trigger recipe_tags_touch_parent
  after insert or update or delete on recipe_tags
  for each row execute function touch_parent_recipe();

create trigger substitutions_touch_parent
  after insert or update or delete on ingredient_substitutions
  for each row execute function touch_grandparent_recipe();

-- ------------------------------------------------------------------------- RLS
-- Same shape as 0001: one private account, so any authenticated session owns the
-- data. Sign-ups are disabled in the dashboard, which is what makes that true.

alter table cook_log enable row level security;

drop policy if exists cook_log_authenticated_all on cook_log;
create policy cook_log_authenticated_all on cook_log
  for all to authenticated using (true) with check (true);
