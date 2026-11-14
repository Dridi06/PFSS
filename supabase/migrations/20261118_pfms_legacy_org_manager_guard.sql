-- PFMS legacy organization manager authorization.
-- The legacy invitation RPC references this helper, but no definition was
-- present in the tracked SQL setup/migration files. Keep authorization
-- server-side and derive the caller exclusively from auth.uid().

create or replace function public.can_manage_org(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and p_organization_id is not null
    and exists (
      select 1
      from public.organization_memberships m
      where m.organization_id = p_organization_id
        and m.user_id = auth.uid()
        and m.status = 'active'
        and m.role in ('owner', 'club_admin', 'agency_admin')
    );
$$;

revoke all on function public.can_manage_org(uuid) from public, anon;
grant execute on function public.can_manage_org(uuid) to authenticated;

comment on function public.can_manage_org(uuid) is
  'Returns true only for the authenticated user''s active owner/club_admin/agency_admin membership in the requested legacy organization.';
