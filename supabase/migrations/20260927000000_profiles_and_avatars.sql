-- Assignment 3: profiles table, new-user trigger, avatars storage, joke authorship.
-- RLS on public tables stays off for now (enabled in a later assignment).

-- 1. profiles: one row per auth user, same id as auth.users.id
create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  first_name        text,
  last_name         text,
  profile_photo_url text, -- URL into the avatars bucket; never binary data
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- 2. trigger: create a profile row whenever Supabase Auth adds a user
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. backfill profiles for users that existed before the trigger
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

-- 4. jokes get an optional author
alter table public.jokes
  add column user_id uuid references public.profiles (id) on delete set null;

-- 5. avatars bucket: public read, images only, 2 MB max
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

-- Signed-in users may only write inside their own folder: avatars/<user id>/...
-- (select + update are needed for upsert, which overwrites the previous photo)
create policy "Users can upload their own avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can update their own avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can read their own avatar object"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- The trigger function should only run from the trigger, never via /rest/v1/rpc
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Lets users remove their photo (and go back to the initials avatar)
create policy "Users can delete their own avatar"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
