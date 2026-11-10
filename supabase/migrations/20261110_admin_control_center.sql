-- PFSS Admin Control Center
-- Run once in Supabase SQL Editor after reviewing the migration.
-- Only approved administrators can list or modify profiles.

create or replace function public.pfss_admin_list_profiles()
returns table (
  id uuid,
  username text,
  role text,
  status text
)
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

create or replace function public.pfss_admin_update_profile(
  p_user_id uuid,
  p_role text,
  p_status text
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
  set role = p_role,
      status = p_status
  where id = p_user_id;

  if not found then
    raise exception 'Profile not found';
  end if;
end;
$$;

revoke all on function public.pfss_admin_list_profiles() from public, anon;
revoke all on function public.pfss_admin_update_profile(uuid, text, text) from public, anon;
grant execute on function public.pfss_admin_list_profiles() to authenticated;
grant execute on function public.pfss_admin_update_profile(uuid, text, text) to authenticated;
