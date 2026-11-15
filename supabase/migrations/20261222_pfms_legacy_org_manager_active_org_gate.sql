-- Ensure legacy organization managers lose management authority when their
-- organization is suspended, rejected, or otherwise not approved/active.
-- This is additive: it replaces the helper without changing membership data.

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
      from public.organizations o
      join public.organization_memberships m
        on m.organization_id = o.id
      where o.id = p_organization_id
        and o.status in ('approved', 'active')
        and m.user_id = auth.uid()
        and m.status = 'active'
        and m.role in ('owner', 'club_admin', 'agency_admin')
    );
$$;

revoke all on function public.can_manage_org(uuid) from public, anon;
grant execute on function public.can_manage_org(uuid) to authenticated;

comment on function public.can_manage_org(uuid) is
  'Returns true only for the authenticated user''s active owner/club_admin/agency_admin membership in an approved or active legacy organization.';
