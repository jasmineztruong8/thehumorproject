-- Lets a signed-in user delete their own account (no service key needed).
-- Deleting the auth user cascades to their profiles row; their jokes stay
-- on the site with user_id set to null.
create function public.delete_my_account()
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
