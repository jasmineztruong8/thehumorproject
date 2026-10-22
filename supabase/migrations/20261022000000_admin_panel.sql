-- Assignment 6: the admin panel (a separate app on this same database).
-- Superadmins can read every vote and fix up AI-generated media: edit an
-- image's title/description or a caption's text. Nobody else can update
-- images or captions, and no one (not even superadmins) can change who made
-- something, its score, or the prompt/model that produced it.

-- 1. Votes: voters still only see their own; superadmins see all of them -----

create policy "Superadmins can read all votes"
  on public.caption_votes for select to authenticated
  using ((select private.is_superadmin()));

-- 2. Images: only the descriptive text can be edited -------------------------

revoke update on public.images from anon, authenticated;
grant update (title, attribution, description) on public.images to authenticated;

create policy "Superadmins can edit images"
  on public.images for update to authenticated
  using ((select private.is_superadmin()))
  with check ((select private.is_superadmin()));

-- 3. Captions: only the text can be edited -----------------------------------

revoke update on public.captions from anon, authenticated;
grant update (content) on public.captions to authenticated;

create policy "Superadmins can edit captions"
  on public.captions for update to authenticated
  using ((select private.is_superadmin()))
  with check ((select private.is_superadmin()));
