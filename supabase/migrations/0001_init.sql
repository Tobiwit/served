-- Served — schema
--
-- Nutrition is normalised per 100 g on `ingredients` and every macro is nullable:
-- NULL means unknown, never zero. Recipe totals are never stored as the source of
-- truth; they are calculated from recipe_ingredients.grams at read time.

create extension if not exists "uuid-ossp";

create type ingredient_role as enum ('core', 'optional', 'substitutable', 'basic');
create type course_type as enum ('breakfast', 'lunch', 'dinner', 'snack', 'dessert');

-- ---------------------------------------------------------------- ingredients

create table ingredients (
  id            text primary key,
  name          text not null,
  search_name   text not null,
  category      text not null default 'other',
  kcal_100g     numeric,
  protein_100g  numeric,
  carbs_100g    numeric,
  fat_100g      numeric,
  fiber_100g    numeric,
  water_100g    numeric,
  default_basic boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index ingredients_search_name_idx on ingredients (search_name);

create table ingredient_aliases (
  id               uuid primary key default uuid_generate_v4(),
  ingredient_id    text not null references ingredients (id) on delete cascade,
  alias            text not null,
  normalized_alias text not null
);

create index ingredient_aliases_ingredient_idx on ingredient_aliases (ingredient_id);
create index ingredient_aliases_normalized_idx on ingredient_aliases (normalized_alias);

-- 1 tbsp olive oil -> 13.5 g. Per-ingredient, because 1 tbsp honey is 21 g.
create table ingredient_unit_conversions (
  id             uuid primary key default uuid_generate_v4(),
  ingredient_id  text not null references ingredients (id) on delete cascade,
  unit           text not null,
  grams_per_unit numeric not null,
  unique (ingredient_id, unit)
);

-- -------------------------------------------------------------------- recipes

create table recipes (
  id            text primary key,
  title         text not null,
  description   text,
  servings      integer not null default 1 check (servings > 0),
  prep_minutes  integer,
  cook_minutes  integer,
  total_minutes integer,
  cuisine       text,
  course_type   course_type,
  image_url     text,
  image_prompt  text,
  source_text   text,
  source_name   text,
  notes         text,
  favorite      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index recipes_created_at_idx on recipes (created_at desc);
create index recipes_favorite_idx on recipes (favorite) where favorite;

create table recipe_ingredients (
  id            text primary key,
  recipe_id     text not null references recipes (id) on delete cascade,
  ingredient_id text references ingredients (id) on delete set null,
  display_name  text not null,
  amount        numeric,
  unit          text,
  grams         numeric,
  role          ingredient_role not null default 'core',
  sort_order    integer not null default 0,
  notes         text
);

create index recipe_ingredients_recipe_idx on recipe_ingredients (recipe_id);
create index recipe_ingredients_ingredient_idx on recipe_ingredients (ingredient_id);

create table ingredient_substitutions (
  id                       text primary key,
  recipe_ingredient_id     text not null references recipe_ingredients (id) on delete cascade,
  substitute_ingredient_id text references ingredients (id) on delete set null,
  display_name             text not null,
  amount_multiplier        numeric,
  notes                    text
);

create index ingredient_substitutions_ri_idx on ingredient_substitutions (recipe_ingredient_id);

create table recipe_instructions (
  id          text primary key,
  recipe_id   text not null references recipes (id) on delete cascade,
  step_number integer not null,
  text        text not null
);

create index recipe_instructions_recipe_idx on recipe_instructions (recipe_id, step_number);

-- ----------------------------------------------------------------------- tags

create table tags (
  id   uuid primary key default uuid_generate_v4(),
  name text not null unique
);

create table recipe_tags (
  recipe_id text not null references recipes (id) on delete cascade,
  tag_id    uuid not null references tags (id) on delete cascade,
  primary key (recipe_id, tag_id)
);

-- ---------------------------------------------------------------- score cache
-- Derived only. Safe to truncate; the app recomputes from ingredients on read.

create table recipe_scores (
  recipe_id        text primary key references recipes (id) on delete cascade,
  health_score     integer,
  volume_score     integer,
  health_breakdown jsonb,
  volume_breakdown jsonb,
  calculated_at    timestamptz not null default now()
);

-- ------------------------------------------------------------------- updated_at

create or replace function touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger recipes_touch before update on recipes
  for each row execute function touch_updated_at();

create trigger ingredients_touch before update on ingredients
  for each row execute function touch_updated_at();

-- -------------------------------------------------------------------------- RLS
-- Single-user app. These policies assume any authenticated session owns the data;
-- add an owner column and scope on auth.uid() if this ever becomes multi-user.

alter table ingredients                 enable row level security;
alter table ingredient_aliases          enable row level security;
alter table ingredient_unit_conversions enable row level security;
alter table recipes                     enable row level security;
alter table recipe_ingredients          enable row level security;
alter table ingredient_substitutions    enable row level security;
alter table recipe_instructions         enable row level security;
alter table tags                        enable row level security;
alter table recipe_tags                 enable row level security;
alter table recipe_scores               enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'ingredients', 'ingredient_aliases', 'ingredient_unit_conversions',
    'recipes', 'recipe_ingredients', 'ingredient_substitutions',
    'recipe_instructions', 'tags', 'recipe_tags', 'recipe_scores'
  ] loop
    execute format(
      'create policy %I on %I for all to authenticated using (true) with check (true)',
      t || '_authenticated_all', t
    );
  end loop;
end $$;

-- ------------------------------------------------------------------- storage
-- Recipe photos. The app compresses to ~1100px JPEG before upload; without
-- Supabase configured the same image is kept as a data URL on the device.

insert into storage.buckets (id, name, public)
values ('recipe-images', 'recipe-images', true)
on conflict (id) do nothing;

create policy "recipe images are readable"
  on storage.objects for select
  using (bucket_id = 'recipe-images');

create policy "recipe images are writable by authenticated users"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'recipe-images');

create policy "recipe images are updatable by authenticated users"
  on storage.objects for update to authenticated
  using (bucket_id = 'recipe-images');

create policy "recipe images are removable by authenticated users"
  on storage.objects for delete to authenticated
  using (bucket_id = 'recipe-images');
