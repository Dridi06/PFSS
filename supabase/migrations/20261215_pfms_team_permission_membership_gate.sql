-- Close the remaining permission-helper bypass: module staff grants must
-- never bypass the central active organization-membership/team-access check.

create or replace function public.pfms_has_legacy_team_permission(
  p_team_id uuid,
  p_module_key text,
  p_action text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and p_team_id is not null
    and public.pfms_can_access_legacy_team(p_team_id)
    and p_module_key in (
      'squad','training','attendance','finance',
      'events','calendar','matches','analysis','tasks'
    )
    and p_action in ('view','edit')
    and (
      public.pfms_can_manage_legacy_team(p_team_id)
      or exists (
        select 1
        from public.pfms_legacy_team_staff s
        join public.pfms_legacy_team_permissions p
          on p.assignment_id = s.id
        where s.team_id = p_team_id
          and s.user_id = auth.uid()
          and s.status = 'active'
          and p.module_key = p_module_key
          and case p_action
            when 'view' then p.can_view
            when 'edit' then p.can_edit
            else false
          end
      )
    );
$$;

create or replace function public.pfms_list_legacy_team_permissions(
  p_assignment_id uuid
)
returns table (
  module_key text,
  can_view boolean,
  can_edit boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
begin
  select s.team_id into v_team_id
  from public.pfms_legacy_team_staff s
  where s.id = p_assignment_id;

  if not found then
    raise exception 'Team staff assignment not found' using errcode = 'P0002';
  end if;

  if not public.pfms_can_access_legacy_team(v_team_id)
     or not (
       public.pfms_can_manage_legacy_team(v_team_id)
       or exists (
         select 1
         from public.pfms_legacy_team_staff s
         where s.id = p_assignment_id
           and s.user_id = auth.uid()
           and s.status = 'active'
       )
     ) then
    raise exception 'Not authorized to view team permissions' using errcode = '42501';
  end if;

  return query
  select modules.module_key,
         coalesce(p.can_view, false),
         coalesce(p.can_edit, false)
  from (values
    ('squad'::text),
    ('training'::text),
    ('attendance'::text),
    ('finance'::text),
    ('events'::text),
    ('calendar'::text),
    ('matches'::text),
    ('analysis'::text),
    ('tasks'::text)
  ) as modules(module_key)
  left join public.pfms_legacy_team_permissions p
    on p.assignment_id = p_assignment_id
   and p.module_key = modules.module_key
  order by case modules.module_key
    when 'squad' then 1
    when 'training' then 2
    when 'attendance' then 3
    when 'finance' then 4
    when 'events' then 5
    when 'calendar' then 6
    when 'matches' then 7
    when 'analysis' then 8
    else 9
  end;
end;
$$;

revoke all on function public.pfms_has_legacy_team_permission(uuid,text,text)
  from public, anon;
revoke all on function public.pfms_list_legacy_team_permissions(uuid)
  from public, anon;
grant execute on function public.pfms_has_legacy_team_permission(uuid,text,text)
  to authenticated;
grant execute on function public.pfms_list_legacy_team_permissions(uuid)
  to authenticated;

comment on function public.pfms_has_legacy_team_permission(uuid,text,text) is
  'Module-level permissions are evaluated only after central team access verifies the current active organization membership and organization status.';
comment on function public.pfms_list_legacy_team_permissions(uuid) is
  'Permission settings are visible only to current team members with central team access, or authorized team managers.';
