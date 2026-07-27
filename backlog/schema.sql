-- ============================================================================
-- Backlogged — database schema
--
-- Run this in the Supabase SQL editor. It is committed so the database is
-- reviewable and reproducible rather than clicked together in a dashboard.
--
-- The security model rests on two decisions:
--
--   1. `libraries` holds the user's whole private document and has NO public
--      policy of any kind. Journal notes, drop reasons and what people paid
--      live in there and must never be world-readable.
--
--   2. Public profiles are served from `public_shelves`, a projection written
--      only by publish_shelf(), a SECURITY DEFINER function that whitelists
--      fields server-side. The client cannot choose what lands in the public
--      table, so a client-side bug cannot leak a private field.
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- profiles — one per account. Public identity only; nothing sensitive.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  handle        text unique,
  display_name  text,
  bio           text,
  is_public     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- lowercase, url-safe, and not mistakable for a route segment
  constraint handle_format check (handle is null or handle ~ '^[a-z0-9_-]{3,24}$'),
  constraint bio_length    check (bio is null or char_length(bio) <= 400),
  constraint name_length   check (display_name is null or char_length(display_name) <= 60)
);

-- ---------------------------------------------------------------------------
-- libraries — the private document. One row per user. Never public.
-- ---------------------------------------------------------------------------
create table if not exists public.libraries (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  doc         jsonb not null default '{}'::jsonb,
  rev         bigint not null default 1,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- public_shelves — the projection. World-readable by design, which is exactly
-- why it is written only by publish_shelf() below.
-- ---------------------------------------------------------------------------
create table if not exists public.public_shelves (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  handle        text not null,
  display_name  text,
  bio           text,
  items         jsonb not null default '[]'::jsonb,
  stats         jsonb not null default '{}'::jsonb,
  published_at  timestamptz not null default now()
);

create index if not exists public_shelves_handle_idx on public.public_shelves (handle);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.libraries      enable row level security;
alter table public.public_shelves enable row level security;

-- Force RLS even for the table owner, so a mistake elsewhere cannot bypass it.
alter table public.libraries      force row level security;
alter table public.public_shelves force row level security;

drop policy if exists profiles_read_public   on public.profiles;
drop policy if exists profiles_read_own      on public.profiles;
drop policy if exists profiles_insert_own    on public.profiles;
drop policy if exists profiles_update_own    on public.profiles;
drop policy if exists profiles_delete_own    on public.profiles;

-- Anyone may look up a profile that has opted in to being public.
create policy profiles_read_public on public.profiles
  for select using (is_public = true);

create policy profiles_read_own on public.profiles
  for select using (auth.uid() = id);

create policy profiles_insert_own on public.profiles
  for insert with check (auth.uid() = id);

create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create policy profiles_delete_own on public.profiles
  for delete using (auth.uid() = id);

-- libraries: owner only, all four verbs. Deliberately no public policy.
drop policy if exists libraries_select_own on public.libraries;
drop policy if exists libraries_insert_own on public.libraries;
drop policy if exists libraries_update_own on public.libraries;
drop policy if exists libraries_delete_own on public.libraries;

create policy libraries_select_own on public.libraries
  for select using (auth.uid() = user_id);

create policy libraries_insert_own on public.libraries
  for insert with check (auth.uid() = user_id);

create policy libraries_update_own on public.libraries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy libraries_delete_own on public.libraries
  for delete using (auth.uid() = user_id);

-- public_shelves: world-readable, but writable only through publish_shelf().
-- No insert or update policy exists for end users at all; the SECURITY DEFINER
-- function is the only write path. Owners may withdraw their own row.
drop policy if exists shelves_read_all   on public.public_shelves;
drop policy if exists shelves_delete_own on public.public_shelves;

create policy shelves_read_all on public.public_shelves
  for select using (true);

create policy shelves_delete_own on public.public_shelves
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- publish_shelf() — the whitelist, enforced server-side.
--
-- Reads the CALLER'S OWN library and copies out only the fields meant to be
-- seen. Anything not named here can never reach the public table: notes,
-- price, drop reasons, hours logged, the weekly shortlist, preferences.
-- ---------------------------------------------------------------------------
create or replace function public.publish_shelf()
returns public.public_shelves
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me        uuid := auth.uid();
  prof      public.profiles;
  doc       jsonb;
  built     jsonb;
  summary   jsonb;
  out_row   public.public_shelves;
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  select * into prof from public.profiles where id = me;

  if prof.handle is null then
    raise exception 'pick a handle before publishing' using errcode = '22023';
  end if;

  if prof.is_public is not true then
    -- Publishing a private profile is a no-op that withdraws instead.
    delete from public.public_shelves where user_id = me;
    return null;
  end if;

  select l.doc into doc from public.libraries l where l.user_id = me;
  doc := coalesce(doc, '{}'::jsonb);

  -- Only games the user explicitly marked as shown, and only these fields.
  select coalesce(jsonb_agg(item order by item->>'title'), '[]'::jsonb)
    into built
  from (
    select jsonb_build_object(
             'id',       e.key,
             'title',    coalesce(e.value->>'publicTitle', e.key),
             'status',   e.value->>'status',
             'score',    e.value->'score',
             'review',   case when coalesce((e.value->>'shareReview')::boolean, false)
                              then left(coalesce(e.value->>'review', ''), 8000)
                         else null end,
             'finished', e.value->'finished'
           ) as item
    from jsonb_each(coalesce(doc->'entries', '{}'::jsonb)) as e
    where coalesce((e.value->>'shared')::boolean, false) is true
  ) picked;

  select jsonb_build_object(
           'total',     jsonb_array_length(built),
           'finished',  (select count(*) from jsonb_array_elements(built) x
                          where x->>'status' = 'completed')
         )
    into summary;

  insert into public.public_shelves as s
         (user_id, handle, display_name, bio, items, stats, published_at)
  values (me, prof.handle, prof.display_name, prof.bio, built, summary, now())
  on conflict (user_id) do update
    set handle       = excluded.handle,
        display_name = excluded.display_name,
        bio          = excluded.bio,
        items        = excluded.items,
        stats        = excluded.stats,
        published_at = excluded.published_at
  returning * into out_row;

  return out_row;
end;
$$;

revoke all on function public.publish_shelf() from public;
grant execute on function public.publish_shelf() to authenticated;

-- ---------------------------------------------------------------------------
-- withdraw_shelf() — take a profile back out of public view.
-- ---------------------------------------------------------------------------
create or replace function public.withdraw_shelf()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  delete from public.public_shelves where user_id = auth.uid();
  update public.profiles set is_public = false, updated_at = now() where id = auth.uid();
end;
$$;

revoke all on function public.withdraw_shelf() from public;
grant execute on function public.withdraw_shelf() to authenticated;

-- ---------------------------------------------------------------------------
-- handle_available() — lets the profile form check a name without granting
-- read access to the profiles table.
--
-- Note it deliberately returns true for the caller's OWN current handle, so
-- re-saving your profile is not blocked by your own name.
--
-- Accepted trade-off: because handles are globally unique, this necessarily
-- reveals whether a given handle is taken, including by a private profile.
-- That is true of every username field on the web; it exposes the name only,
-- never the account behind it.
-- ---------------------------------------------------------------------------
create or replace function public.handle_available(want text)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select want ~ '^[a-z0-9_-]{3,24}$'
     and not exists (
       select 1 from public.profiles
        where handle = want and (auth.uid() is null or id <> auth.uid())
     );
$$;

revoke all on function public.handle_available(text) from public;
grant execute on function public.handle_available(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Create a profile row automatically for every new account.
-- ---------------------------------------------------------------------------
create or replace function public.on_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.on_auth_user_created();

-- ---------------------------------------------------------------------------
-- Keep updated_at honest.
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch  on public.profiles;
drop trigger if exists libraries_touch on public.libraries;

create trigger profiles_touch  before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger libraries_touch before update on public.libraries
  for each row execute function public.touch_updated_at();
