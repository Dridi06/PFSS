-- PFSS: username registration profile sync
-- Execute once in Supabase SQL Editor.
-- Preserves existing profile roles/status (including the current administrator).

create unique index if not exists profiles_username_lower_unique
on public.profiles (lower(username))
where username is not null;

create or replace function public.pfss_sync_signup_username()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  requested_username text;
begin
  requested_username := trim(coalesce(new.raw_user_meta_data ->> 'username', ''));

  if requested_username = '' then
    return new;
  end if;

  if requested_username !~ '^[A-Za-z0-9_.-]{3,20}$' then
    raise exception 'Invalid PFSS username';
  end if;

  insert into public.profiles (id, username, role, status)
  values (new.id, requested_username, 'user', 'pending')
  on conflict (id) do update
    set username = excluded.username;

  return new;
end;
$$;

drop trigger if exists pfss_sync_signup_username on auth.users;

create trigger pfss_sync_signup_username
after insert on auth.users
for each row execute function public.pfss_sync_signup_username();

-- Existing admin profile remains admin/approved because the conflict branch
-- updates only username, not role or status.
