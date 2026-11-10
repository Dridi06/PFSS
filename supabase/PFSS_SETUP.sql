-- PFSS ONE-TIME DATABASE SETUP
-- Paste this complete file into Supabase SQL Editor and click Run.
-- Includes username registration sync and secure admin user management.

-- 1) Username registration sync
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

-- 2) Admin-only user listing
create or replace function public.pfss_admin_list_profiles()
returns table (id uuid, username text, role text, status text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  return query
    select p.id, p.username, p.role, p.status
    from public.profiles p
    order by
      case p.status when 'pending' then 0 when 'approved' then 1 else 2 end,
      lower(coalesce(p.username, ''));
end;
$$;

-- 3) Admin-only profile role/status updates
create or replace function public.pfss_admin_update_profile(
  p_user_id uuid, p_role text, p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_role not in ('user', 'scout', 'admin') then
    raise exception 'Invalid role';
  end if;
  if p_status not in ('pending', 'approved', 'suspended') then
    raise exception 'Invalid status';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot change your own administrator profile';
  end if;

  update public.profiles
  set role = p_role, status = p_status
  where id = p_user_id;

  if not found then raise exception 'Profile not found'; end if;
end;
$$;

revoke all on function public.pfss_admin_list_profiles() from public, anon;
revoke all on function public.pfss_admin_update_profile(uuid, text, text) from public, anon;
grant execute on function public.pfss_admin_list_profiles() to authenticated;
grant execute on function public.pfss_admin_update_profile(uuid, text, text) to authenticated;
