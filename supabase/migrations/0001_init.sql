-- Loop — initial schema
-- Run this in the Supabase SQL editor (or via `supabase db push`).
-- Mirrors src/lib/types.ts. Geometry is stored in PostGIS so we can search by
-- area ("routes near here") and compute distances server-side.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists postgis;
-- gen_random_uuid() is built in on Postgres 13+ (Supabase), no extension needed.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type reaction_kind as enum ('like', 'ok', 'dislike');
exception when duplicate_object then null; end $$;

do $$ begin
  create type comparison_winner as enum ('a', 'b', 'tie');
exception when duplicate_object then null; end $$;

do $$ begin
  create type route_source as enum ('seed', 'user', 'discovered');
exception when duplicate_object then null; end $$;

-- route_type and surface/flatness are kept as plain text + CHECK so we can add
-- values without a migration; the app validates against its own lists.

-- ---------------------------------------------------------------------------
-- profiles  (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     text unique not null,
  name         text not null default '',
  city         text,
  avatar_color text not null default '#22e06a',
  bio          text,
  badges       text[] not null default '{}',
  -- linked later when Strava login/import is approved
  strava_athlete_id text unique,
  -- 'mi' or 'km' — which units to display distances/elevation in.
  unit_preference text not null default 'mi',
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- routes
-- ---------------------------------------------------------------------------
create table if not exists public.routes (
  id            uuid primary key default gen_random_uuid(),
  creator_id    uuid references public.profiles (id) on delete set null,
  name          text not null,
  description   text not null default '',
  city          text not null,
  route_type    text not null default 'Easy',
  -- User-described attributes (no verification, per product decision).
  -- Stored as free text; the app offers presets (surface: Paved/Trail/Gravel/
  -- Track/Mixed, flatness: Flat/Rolling/Hilly, route_type: Long Run/Tempo/…).
  surface       text,
  flatness      text,
  -- Canonical SI units. The app converts to miles OR km for display per the
  -- user's unit_preference, so there's a single source of truth.
  distance_m    double precision not null,   -- auto-computed from the drawn line
  elevation_m   double precision not null default 0,
  -- Geometry: the full path + a start point for proximity search.
  geom          geography(LineString, 4326) not null,
  start_point   geography(Point, 4326) not null,
  image         text,
  source        route_source not null default 'user',
  loop_certified boolean not null default false,
  run_count     integer not null default 0,
  -- AI-predicted tags at discovery time (tag ids); empty for user-drawn routes.
  predicted_tags text[] not null default '{}',
  -- Stable id of the run cluster this was promoted from; null for user routes.
  cluster_id    text unique,
  created_at    timestamptz not null default now()
);

create index if not exists routes_geom_idx        on public.routes using gist (geom);
create index if not exists routes_start_point_idx on public.routes using gist (start_point);
create index if not exists routes_city_idx         on public.routes (city);
create index if not exists routes_creator_idx      on public.routes (creator_id);

-- ---------------------------------------------------------------------------
-- reactions  (one-tap 👍/😐/👎 + optional tags/text/photos)
-- ---------------------------------------------------------------------------
create table if not exists public.reactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  route_id      uuid not null references public.routes (id) on delete cascade,
  reaction      reaction_kind not null,
  tags          text[] not null default '{}',
  text          text,
  photos        text[] not null default '{}',
  from_activity boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- One current reaction per user per route: a person can't both like AND
  -- dislike. Re-reacting upserts (updates) the existing row.
  unique (user_id, route_id)
);
create index if not exists reactions_route_idx on public.reactions (route_id);
create index if not exists reactions_user_idx  on public.reactions (user_id);

-- ---------------------------------------------------------------------------
-- comparisons  (A/B "which would you rather run?")
-- ---------------------------------------------------------------------------
create table if not exists public.comparisons (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  route_a_id  uuid not null references public.routes (id) on delete cascade,
  route_b_id  uuid not null references public.routes (id) on delete cascade,
  winner      comparison_winner not null,
  created_at  timestamptz not null default now()
);
create index if not exists comparisons_a_idx on public.comparisons (route_a_id);
create index if not exists comparisons_b_idx on public.comparisons (route_b_id);

-- ---------------------------------------------------------------------------
-- follows / saved_routes / collections
-- ---------------------------------------------------------------------------
create table if not exists public.follows (
  follower_id  uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table if not exists public.saved_routes (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  route_id   uuid not null references public.routes (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, route_id)
);

create table if not exists public.collections (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.collection_routes (
  collection_id uuid not null references public.collections (id) on delete cascade,
  route_id      uuid not null references public.routes (id) on delete cascade,
  primary key (collection_id, route_id)
);

-- ---------------------------------------------------------------------------
-- discovery_clusters  (server-only: makes AI naming once-ever, not per-session)
-- ---------------------------------------------------------------------------
create table if not exists public.discovery_clusters (
  cluster_id text primary key,
  route_id   uuid references public.routes (id) on delete set null,
  named_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Auto-create a profile row when a new auth user signs up.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, name)
  values (
    new.id,
    -- default username from email local-part; user can change it later
    coalesce(split_part(new.email, '@', 1), 'runner') || '_' || substr(new.id::text, 1, 4),
    coalesce(new.raw_user_meta_data ->> 'name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Product rule: routes are PUBLIC and UNMODERATED — anyone signed in can add a
-- route, and everyone can read all routes. Discovered/seed routes are inserted
-- by the service role (which bypasses RLS).
-- ---------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.routes            enable row level security;
alter table public.reactions         enable row level security;
alter table public.comparisons       enable row level security;
alter table public.follows           enable row level security;
alter table public.saved_routes      enable row level security;
alter table public.collections       enable row level security;
alter table public.collection_routes enable row level security;
alter table public.discovery_clusters enable row level security; -- no policies => service-role only

-- profiles: world-readable; you manage your own row
create policy "profiles read"   on public.profiles for select using (true);
create policy "profiles insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles update" on public.profiles for update using (auth.uid() = id);

-- routes: world-readable; any signed-in user may add; edit/delete your own
create policy "routes read"   on public.routes for select using (true);
create policy "routes insert" on public.routes for insert with check (auth.uid() = creator_id);
create policy "routes update" on public.routes for update using (auth.uid() = creator_id);
create policy "routes delete" on public.routes for delete using (auth.uid() = creator_id);

-- reactions: world-readable; manage your own
create policy "reactions read"   on public.reactions for select using (true);
create policy "reactions insert" on public.reactions for insert with check (auth.uid() = user_id);
create policy "reactions update" on public.reactions for update using (auth.uid() = user_id);
create policy "reactions delete" on public.reactions for delete using (auth.uid() = user_id);

-- comparisons: world-readable (drives ranking); insert your own
create policy "comparisons read"   on public.comparisons for select using (true);
create policy "comparisons insert" on public.comparisons for insert with check (auth.uid() = user_id);

-- follows: world-readable; manage your own following edges
create policy "follows read"   on public.follows for select using (true);
create policy "follows insert" on public.follows for insert with check (auth.uid() = follower_id);
create policy "follows delete" on public.follows for delete using (auth.uid() = follower_id);

-- saved_routes: private to the user
create policy "saved read"   on public.saved_routes for select using (auth.uid() = user_id);
create policy "saved insert" on public.saved_routes for insert with check (auth.uid() = user_id);
create policy "saved delete" on public.saved_routes for delete using (auth.uid() = user_id);

-- collections: world-readable; manage your own
create policy "collections read"   on public.collections for select using (true);
create policy "collections insert" on public.collections for insert with check (auth.uid() = user_id);
create policy "collections update" on public.collections for update using (auth.uid() = user_id);
create policy "collections delete" on public.collections for delete using (auth.uid() = user_id);

create policy "collection_routes read" on public.collection_routes for select using (true);
create policy "collection_routes insert" on public.collection_routes for insert
  with check (exists (
    select 1 from public.collections c
    where c.id = collection_id and c.user_id = auth.uid()
  ));
create policy "collection_routes delete" on public.collection_routes for delete
  using (exists (
    select 1 from public.collections c
    where c.id = collection_id and c.user_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- Read helper: routes with geometry as GeoJSON, so the app gets path/start
-- back in the same [lng,lat] shape it already uses (src/lib/types.ts).
-- ---------------------------------------------------------------------------
create or replace view public.routes_geojson
with (security_invoker = true) as
select
  r.*,
  st_asgeojson(r.geom)        as geom_geojson,
  st_asgeojson(r.start_point) as start_geojson
from public.routes r;
