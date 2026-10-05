-- Assignment 2: the original jokes table. Recreated here from the remote
-- migration history so a fresh database (and the RLS tests) can replay every
-- migration in order. Replaced by images + captions in Assignment 4.
create table if not exists public.jokes (
  id         uuid primary key default gen_random_uuid(),
  content    text not null,
  votes      integer not null default 0,
  created_at timestamptz not null default now()
);
