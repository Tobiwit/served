-- Lunch and dinner become one course: `main`.
--
-- The same bowl of noodles answers both, so the split only ever hid recipes from one
-- half of the day. Postgres will not drop a value from an enum, so the type is
-- rebuilt rather than edited: park the column on text, fold the two old values into
-- one, then swap a clean enum back in.
--
-- Deliberately no `alter type ... add value`: a value added that way cannot be used
-- until its transaction commits, and migration runners wrap a file in one. Going via
-- text keeps the whole change inside a single transaction.
--
-- Safe to run twice — a database already on the new enum takes the early exit.

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'course_type' and e.enumlabel in ('lunch', 'dinner')
  ) then
    return;
  end if;

  alter table recipes alter column course_type type text using course_type::text;

  update recipes set course_type = 'main' where course_type in ('lunch', 'dinner');

  drop type course_type;
  create type course_type as enum ('breakfast', 'main', 'snack', 'dessert');

  alter table recipes alter column course_type type course_type using course_type::course_type;
end
$$;
