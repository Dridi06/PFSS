-- PFMS tenant isolation: legacy team access must remain tied to an active
-- membership in the team's own organization. Prevent stale staff assignments
-- from surviving organization suspension or membership removal.

create or replace function public.pfms_can_access_legacy_team(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and (
      public.is_admin()
      or exists (
        select 1
        from public.pfms_legacy_teams t
        join public.organizations o on o.id = t.organization_id
        where t.id = p_team_id
          and o.status in ('approved', 'active')
          and public.can_manage_org(o.id)
      )
      or exists (
        select 1
        from public.pfms_legacy_teams t
        join public.organizations o on o.id = t.organization_id
        join public.pfms_legacy_team_staff s
          on s.team_id = t.id
         and s.user_id = auth.uid()
         and s.status = 'active'
        join public.organization_memberships m
          on m.organization_id = t.organization_id
         and m.user_id = s.user_id
         and m.status = 'active'
         and m.role = s.role
        where t.id = p_team_id
          and o.status in ('approved', 'active')
      )
    );
$$;

create or replace function public.pfms_can_manage_legacy_team(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and (
      public.is_admin()
      or exists (
        select 1
        from public.pfms_legacy_teams t
        join public.organizations o on o.id = t.organization_id
        where t.id = p_team_id
          and o.status in ('approved', 'active')
          and public.can_manage_org(o.id)
      )
      or exists (
        select 1
        from public.pfms_legacy_teams t
        join public.organizations o on o.id = t.organization_id
        join public.pfms_legacy_team_staff s
          on s.team_id = t.id
         and s.user_id = auth.uid()
         and s.role = 'trainer'
         and s.status = 'active'
        join public.organization_memberships m
          on m.organization_id = t.organization_id
         and m.user_id = s.user_id
         and m.role = 'trainer'
         and m.status = 'active'
        where t.id = p_team_id
          and o.status in ('approved', 'active')
      )
    );
$$;

revoke all on function public.pfms_can_access_legacy_team(uuid) from public, anon;
revoke all on function public.pfms_can_manage_legacy_team(uuid) from public, anon;
grant execute on function public.pfms_can_access_legacy_team(uuid) to authenticated;
grant execute on function public.pfms_can_manage_legacy_team(uuid) to authenticated;

comment on function public.pfms_can_access_legacy_team(uuid) is
  'Team access requires an approved/active organization and a current active organization membership matching the active staff assignment; platform admins remain globally authorized.';
comment on function public.pfms_can_manage_legacy_team(uuid) is
  'Team management requires an approved/active organization and either an active organization manager membership or a matching active trainer membership.';
