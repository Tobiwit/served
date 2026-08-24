-- A stand-in gets its own quantity.
--
-- Substitutions only ever carried a name and an optional multiplier, which cannot
-- express the swaps people actually write down: 80 g halloumi *or* 120 g firm tofu,
-- 2 tbsp tahini *or* 60 g yoghurt. These three columns mirror the ones on
-- recipe_ingredients, and null still means "same as the line it replaces".

alter table ingredient_substitutions add column if not exists amount numeric;
alter table ingredient_substitutions add column if not exists unit   text;
alter table ingredient_substitutions add column if not exists grams  numeric;
