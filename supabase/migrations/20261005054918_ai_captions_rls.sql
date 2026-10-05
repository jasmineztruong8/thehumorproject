-- Assignment 4: AI-generated captions on images, caption voting, and RLS on
-- every table. Text jokes are replaced by images + captions.
--
-- Rules enforced here (and covered by tests/db/rls.test.ts):
--   * Everyone (even signed out) can read images and captions.
--   * Only signed-in, non-anonymous users can upload, caption and vote, and
--     only as themselves.
--   * Names (profiles) are only readable by signed-in users.
--   * A profile can be deleted by its owner or a superadmin; that deletes the
--     login and cascades to everything the user created.
--   * Anonymous auth users are never superadmins.

-- 1. Retire the jokes feature ------------------------------------------------

drop table if exists public.votes;
drop table if exists public.jokes;
drop function if exists public.apply_vote_to_joke();
drop function if exists public.delete_my_account();

-- 2. Helpers (private schema: not exposed through /rest/v1/rpc) --------------

create schema if not exists private;
grant usage on schema private to authenticated;

alter table public.profiles
  add column is_superadmin boolean not null default false;

-- Signed in with a real account (Supabase anonymous sign-ins also get the
-- "authenticated" role, so "to authenticated" alone isn't enough).
create function private.is_real_user()
returns boolean
language sql
stable
set search_path = ''
as $$
  select auth.uid() is not null
     and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false;
$$;

-- Security definer so it can read the flag without depending on the
-- profiles select policy.
create function private.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
     and exists (
       select 1 from public.profiles
       where id = auth.uid() and is_superadmin
     );
$$;

revoke execute on function private.is_real_user(), private.is_superadmin() from public, anon;
grant execute on function private.is_real_user(), private.is_superadmin() to authenticated;

-- 3. Profiles: users may only edit their name and photo, never is_superadmin --

revoke insert, update on public.profiles from anon, authenticated;
grant update (first_name, last_name, profile_photo_url, updated_at)
  on public.profiles to authenticated;

-- Deleting a profile deletes the login too, so a profile delete (checked by
-- RLS below) is the one way to delete an account. Deleting the auth user
-- directly (e.g. from the dashboard) still cascades the other way.
create function private.delete_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from auth.users where id = old.id;
  return null;
end;
$$;

revoke execute on function private.delete_auth_user() from public, anon, authenticated;

create trigger on_profile_deleted
  after delete on public.profiles
  for each row execute function private.delete_auth_user();

-- 4. Images: uploads by users, plus a meme library (user_id null) ------------

create table public.images (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid references public.profiles (id) on delete cascade,
  source             text not null check (source in ('upload', 'library')),
  storage_path       text not null unique, -- path in the images bucket; never binary data
  image_url          text not null,
  title              text,
  attribution        text,
  description        text not null, -- AI description, reused for every caption
  description_prompt text not null,
  description_model  text not null,
  created_at         timestamptz not null default now(),
  -- uploads always have an owner, library images never do
  check ((source = 'upload') = (user_id is not null))
);

create index images_user_id_idx on public.images (user_id);
create index images_created_at_idx on public.images (created_at desc);

-- 5. Captions: many per image, from many users -------------------------------

create table public.captions (
  id          uuid primary key default gen_random_uuid(),
  image_id    uuid not null references public.images (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  content     text not null check (char_length(content) between 1 and 300),
  user_prompt text check (char_length(user_prompt) <= 120), -- optional steer from the user
  prompt      text not null, -- full prompt sent to the model
  model       text not null,
  score       integer not null default 0, -- kept in sync by on_caption_vote_change
  created_at  timestamptz not null default now()
);

create index captions_image_id_score_idx on public.captions (image_id, score desc, created_at desc);
create index captions_user_id_created_at_idx on public.captions (user_id, created_at desc);
create index captions_score_idx on public.captions (score desc, created_at desc);

-- 6. Caption votes -----------------------------------------------------------

create table public.caption_votes (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  caption_id uuid not null references public.captions (id) on delete cascade,
  value      smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (user_id, caption_id)
);

create index caption_votes_caption_id_idx on public.caption_votes (caption_id);

create function private.apply_caption_vote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    update public.captions set score = score - old.value where id = old.caption_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    update public.captions set score = score + new.value where id = new.caption_id;
  end if;
  return null;
end;
$$;

revoke execute on function private.apply_caption_vote() from public, anon, authenticated;

create trigger on_caption_vote_change
  after insert or update or delete on public.caption_votes
  for each row execute function private.apply_caption_vote();

-- 7. Row level security ------------------------------------------------------
-- auth.uid() and the helpers are wrapped in (select ...) so Postgres runs
-- them once per query instead of once per row.

alter table public.profiles enable row level security;
alter table public.images enable row level security;
alter table public.captions enable row level security;
alter table public.caption_votes enable row level security;

-- profiles: names are for members only; signed-out visitors see nothing
create policy "Members can read profiles"
  on public.profiles for select to authenticated
  using (true);

create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "Owners and superadmins can delete profiles"
  on public.profiles for delete to authenticated
  using (id = (select auth.uid()) or (select private.is_superadmin()));

-- images
create policy "Anyone can read images"
  on public.images for select to anon, authenticated
  using (true);

create policy "Users can upload their own images"
  on public.images for insert to authenticated
  with check (
    (select private.is_real_user())
    and user_id = (select auth.uid())
    and source = 'upload'
    and storage_path like (select auth.uid())::text || '/%'
  );

create policy "Owners and superadmins can delete images"
  on public.images for delete to authenticated
  using (user_id = (select auth.uid()) or (select private.is_superadmin()));

-- captions
create policy "Anyone can read captions"
  on public.captions for select to anon, authenticated
  using (true);

create policy "Users can add their own captions"
  on public.captions for insert to authenticated
  with check (
    (select private.is_real_user())
    and user_id = (select auth.uid())
    and score = 0
  );

create policy "Owners and superadmins can delete captions"
  on public.captions for delete to authenticated
  using (user_id = (select auth.uid()) or (select private.is_superadmin()));

-- caption_votes: private to the voter; scores are public via captions.score
create policy "Users can read their own votes"
  on public.caption_votes for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can vote"
  on public.caption_votes for insert to authenticated
  with check ((select private.is_real_user()) and user_id = (select auth.uid()));

create policy "Users can change their vote"
  on public.caption_votes for update to authenticated
  using (user_id = (select auth.uid()))
  with check ((select private.is_real_user()) and user_id = (select auth.uid()));

create policy "Users can remove their vote"
  on public.caption_votes for delete to authenticated
  using (user_id = (select auth.uid()));

-- 8. Storage -----------------------------------------------------------------

-- images bucket: public read, images only, 5 MB max.
-- Uploads go to images/<user id>/<random>.jpg; library/ is written only by
-- the seed script (service role).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('images', 'images', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

create policy "Users can upload into their own images folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.is_real_user())
  );

-- select is needed to list a folder and for remove() to return the rows
create policy "Owners and superadmins can read image objects"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'images'
    and ((storage.foldername(name))[1] = (select auth.uid())::text
         or (select private.is_superadmin()))
  );

create policy "Owners and superadmins can delete image objects"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'images'
    and ((storage.foldername(name))[1] = (select auth.uid())::text
         or (select private.is_superadmin()))
  );

-- Superadmins can clean up another user's avatar when deleting them
create policy "Superadmins can read avatar objects"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (select private.is_superadmin()));

create policy "Superadmins can delete avatar objects"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (select private.is_superadmin()));
