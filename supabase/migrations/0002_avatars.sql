-- Loop — profile pictures
-- Run this in the Supabase SQL editor after 0001_init.sql.

-- 1. Column to hold the public avatar URL.
alter table public.profiles add column if not exists avatar_url text;

-- 2. Public storage bucket for avatars.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- 3. RLS on the bucket. Avatars are world-readable; a user may only write files
--    under a folder named with their own user id (path: "<uid>/<file>").
drop policy if exists "avatar read"   on storage.objects;
drop policy if exists "avatar insert" on storage.objects;
drop policy if exists "avatar update" on storage.objects;
drop policy if exists "avatar delete" on storage.objects;

create policy "avatar read" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "avatar insert" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatar update" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatar delete" on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
