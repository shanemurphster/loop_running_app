-- Loop — track whether a user has ever set a password
-- Run this in the Supabase SQL editor after 0002_avatars.sql.
--
-- Email-code (OTP) sign-in never sets auth.users.encrypted_password, so those
-- accounts can only ever sign back in via a fresh code/link, and can't recover
-- access if they lose email access mid-session. password_set drives an
-- in-app nudge ("add a password") for those accounts. It's kept in sync from
-- auth.users by triggers below rather than set by the client, so it stays
-- correct no matter which flow (signUp, updateUser, admin reset) sets the
-- password.

alter table public.profiles
  add column if not exists password_set boolean not null default false;

-- Seed existing rows from current auth.users state.
update public.profiles p
set password_set = (
  coalesce(u.encrypted_password, '') <> ''
)
from auth.users u
where u.id = p.id;

-- 1. On new-user insert, set password_set from whatever auth.users already
--    has (password sign-up sets encrypted_password before this trigger fires;
--    OTP-only sign-up leaves it empty).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, name, password_set)
  values (
    new.id,
    coalesce(split_part(new.email, '@', 1), 'runner') || '_' || substr(new.id::text, 1, 4),
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    (coalesce(new.encrypted_password, '') <> '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 2. Keep password_set in sync whenever encrypted_password changes later
--    (e.g. a code-only user later calls supabase.auth.updateUser({password})).
create or replace function public.handle_user_password_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password then
    update public.profiles
    set password_set = (coalesce(new.encrypted_password, '') <> '')
    where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_password_changed on auth.users;
create trigger on_auth_user_password_changed
  after update on auth.users
  for each row execute function public.handle_user_password_change();
