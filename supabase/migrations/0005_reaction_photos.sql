-- Loop — photos on reviews
-- Run this in the Supabase SQL editor after 0004_strava.sql.
--
-- reactions.photos (text[]) has existed since 0001_init.sql but nothing ever
-- wrote to it. This adds the storage bucket those URLs live in — same
-- world-readable-but-own-folder-only pattern as the avatars bucket in
-- 0002_avatars.sql, just a different bucket so a photo limit/cleanup policy
-- can differ from avatars later if needed.

insert into storage.buckets (id, name, public)
values ('route-photos', 'route-photos', true)
on conflict (id) do nothing;

drop policy if exists "route photo read"   on storage.objects;
drop policy if exists "route photo insert" on storage.objects;
drop policy if exists "route photo update" on storage.objects;
drop policy if exists "route photo delete" on storage.objects;

create policy "route photo read" on storage.objects
  for select using (bucket_id = 'route-photos');

create policy "route photo insert" on storage.objects
  for insert with check (
    bucket_id = 'route-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "route photo update" on storage.objects
  for update using (
    bucket_id = 'route-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "route photo delete" on storage.objects
  for delete using (
    bucket_id = 'route-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
