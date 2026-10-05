-- Library images can now be added by signed-in users (via the server, from
-- Openverse search), and images can be animated GIFs.

-- Who added a library image (for rate limiting). Library images are shared,
-- so they stay when that user deletes their account.
alter table public.images
  add column added_by uuid references public.profiles (id) on delete set null,
  add column is_animated boolean not null default false;

create index images_added_by_idx on public.images (added_by, created_at desc);

-- Library rows are still written only by the server with the service role:
-- the insert policy from ai_captions_rls only allows source = 'upload'.
-- Uploads can't claim to have been "added" to the library.
alter policy "Users can upload their own images"
  on public.images
  with check (
    (select private.is_real_user())
    and user_id = (select auth.uid())
    and source = 'upload'
    and added_by is null
    and storage_path like (select auth.uid())::text || '/%'
  );
