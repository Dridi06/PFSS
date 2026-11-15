-- Harden the legacy, still-executable profile-list RPC.
-- The paginated directory supersedes this endpoint in the current UI, but
-- existing authenticated clients may still call it. Keep it secure rather
-- than relying on the client to stop using it.

create or replace function public.pfss_admin_list_profiles()
returns table (
  id uuid,
  username text,
  role text,
  status text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.pfms_is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  return query
    select p.id, p.username, p.role, p.status
    from public.profiles p
    order by
      case p.status when 'pending' then 0 when 'approved' then 1 else 2 end,
      pg_catalog.lower(coalesce(p.username, ''));
end;
$$;

revoke all on function public.pfss_admin_list_profiles()
  from public, anon;
grant execute on function public.pfss_admin_list_profiles()
  to authenticated;

comment on function public.pfss_admin_list_profiles() is
  'Legacy administrator-only profile listing retained with an empty search_path; the current UI uses the bounded paginated profile RPC.';
