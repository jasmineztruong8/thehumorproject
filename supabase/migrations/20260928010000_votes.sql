-- Signed-in users can upvote (+1) or downvote (-1) each joke once, and change
-- or remove their vote. jokes.votes stays the displayed score: the seeded
-- starting counts plus every vote, kept in sync by the trigger below.
create table public.votes (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  joke_id    uuid not null references public.jokes (id) on delete cascade,
  value      smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (user_id, joke_id)
);

create index votes_joke_id_idx on public.votes (joke_id);

create function public.apply_vote_to_joke()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    update public.jokes set votes = coalesce(votes, 0) - old.value where id = old.joke_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    update public.jokes set votes = coalesce(votes, 0) + new.value where id = new.joke_id;
  end if;
  return null;
end;
$$;

create trigger on_vote_change
  after insert or update or delete on public.votes
  for each row execute function public.apply_vote_to_joke();

revoke execute on function public.apply_vote_to_joke() from public, anon, authenticated;
