-- Loop — Strava OAuth token storage
-- Run this in the Supabase SQL editor after 0003_password_set.sql.
--
-- profiles.strava_athlete_id already exists (added in 0001_init.sql, unused
-- until now) and gets populated by the OAuth callback. Tokens themselves are
-- far more sensitive and do NOT belong on the world-readable profiles table
-- (its "profiles read" policy is `using (true)`) — they live here instead.

create table if not exists public.strava_tokens (
  user_id       uuid primary key references public.profiles (id) on delete cascade,
  athlete_id    text not null,
  access_token  text not null,
  refresh_token text not null,
  expires_at    timestamptz not null,
  scope         text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- RLS enabled, but with NO policies — same pattern as discovery_clusters in
-- 0001_init.sql. Only the service-role client (server-only route handlers)
-- can read or write this table; it must never be readable from a user's own
-- browser session, unlike the rest of their profile.
alter table public.strava_tokens enable row level security;
