-- PFMS team-task assignees must retain their current organization membership.
-- Prevent stale staff assignments from receiving new tasks after membership
-- revocation, suspension, organization suspension, or a role mismatch.

create or replace function public.pfms_create_legacy_team_task(
  p_team_id uuid,
  p_title text,
  p_description text default null,
  p_assigned_to uuid default null,
  p_due_date date default null,
  p_priority text default 'normal',
  p_status text default 'open'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task_id uuid;
  v_assignee uuid;
begin
  if p_team_id is null
     or not public.pfms_has_legacy_team_permission(p_team_id, 'tasks', 'edit') then
    raise exception 'Not authorized to create team tasks' using errcode = '42501';
  end if;

  if p_title is null
     or pg_catalog.length(pg_catalog.btrim(p_title)) not between 3 and 160
     or (p_description is not null and pg_catalog.length(p_description) > 3000)
     or p_priority is null or p_priority not in ('low','normal','high')
     or p_status is null or p_status not in ('open','in_progress','done','cancelled') then
    raise exception 'Invalid team task data' using errcode = '22023';
  end if;

  if p_assigned_to is not null then
    select s.user_id into v_assignee
    from public.pfms_legacy_team_staff s
    join public.pfms_legacy_teams t on t.id = s.team_id
    join public.organizations o on o.id = t.organization_id
    join public.organization_memberships m
      on m.organization_id = t.organization_id
     and m.user_id = s.user_id
     and m.status = 'active'
     and m.role = s.role
    where s.team_id = p_team_id
      and s.user_id = p_assigned_to
      and s.status = 'active'
      and o.status in ('approved','active')
    for share of s, o, m;
    if not found then
      raise exception 'Task assignee must be active staff with a matching active organization membership'
        using errcode = '23514';
    end if;
  end if;

  insert into public.pfms_legacy_team_tasks (
    team_id, title, description, assigned_to, due_date, priority, status, completed_at, created_by
  ) values (
    p_team_id, pg_catalog.btrim(p_title),
    nullif(pg_catalog.btrim(coalesce(p_description,'')), ''),
    v_assignee, p_due_date, p_priority, p_status,
    case when p_status = 'done' then pg_catalog.now() else null end,
    auth.uid()
  )
  returning id into v_task_id;

  return v_task_id;
end;
$$;

create or replace function public.pfms_update_legacy_team_task(
  p_task_id uuid,
  p_title text,
  p_description text,
  p_assigned_to uuid,
  p_due_date date,
  p_priority text,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
  v_assignee uuid;
begin
  select t.team_id into v_team_id
  from public.pfms_legacy_team_tasks t
  where t.id = p_task_id
  for update;

  if not found then
    raise exception 'Team task not found' using errcode = 'P0002';
  end if;
  if not public.pfms_has_legacy_team_permission(v_team_id, 'tasks', 'edit') then
    raise exception 'Not authorized to update team tasks' using errcode = '42501';
  end if;

  if p_title is null
     or pg_catalog.length(pg_catalog.btrim(p_title)) not between 3 and 160
     or (p_description is not null and pg_catalog.length(p_description) > 3000)
     or p_priority is null or p_priority not in ('low','normal','high')
     or p_status is null or p_status not in ('open','in_progress','done','cancelled') then
    raise exception 'Invalid team task data' using errcode = '22023';
  end if;

  if p_assigned_to is not null then
    select s.user_id into v_assignee
    from public.pfms_legacy_team_staff s
    join public.pfms_legacy_teams t on t.id = s.team_id
    join public.organizations o on o.id = t.organization_id
    join public.organization_memberships m
      on m.organization_id = t.organization_id
     and m.user_id = s.user_id
     and m.status = 'active'
     and m.role = s.role
    where s.team_id = v_team_id
      and s.user_id = p_assigned_to
      and s.status = 'active'
      and o.status in ('approved','active')
    for share of s, o, m;
    if not found then
      raise exception 'Task assignee must be active staff with a matching active organization membership'
        using errcode = '23514';
    end if;
  end if;

  update public.pfms_legacy_team_tasks
  set title = pg_catalog.btrim(p_title),
      description = nullif(pg_catalog.btrim(coalesce(p_description,'')), ''),
      assigned_to = v_assignee,
      due_date = p_due_date,
      priority = p_priority,
      status = p_status
  where id = p_task_id;
end;
$$;

revoke all on function public.pfms_create_legacy_team_task(uuid, text, text, uuid, date, text, text) from public, anon;
grant execute on function public.pfms_create_legacy_team_task(uuid, text, text, uuid, date, text, text) to authenticated;
revoke all on function public.pfms_update_legacy_team_task(uuid, text, text, uuid, date, text, text) from public, anon;
grant execute on function public.pfms_update_legacy_team_task(uuid, text, text, uuid, date, text, text) to authenticated;

comment on function public.pfms_create_legacy_team_task(uuid, text, text, uuid, date, text, text) is
  'Creates team tasks only for active staff whose organization membership and role still match the team assignment.';
comment on function public.pfms_update_legacy_team_task(uuid, text, text, uuid, date, text, text) is
  'Updates team tasks only for active staff whose organization membership and role still match the team assignment.';
