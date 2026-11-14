-- PFMS team-shared tasks.
-- Adds a ninth team permission module without changing private personal tasks.
-- Task assignments are constrained to staff belonging to the same team.

alter table public.pfms_legacy_team_permissions
  drop constraint if exists pfms_legacy_team_permissions_module_key_check;
alter table public.pfms_legacy_team_permissions
  add constraint pfms_legacy_team_permissions_module_key_check
  check (module_key in (
    'squad','training','attendance','finance',
    'events','calendar','matches','analysis','tasks'
  ));

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

  if not (
    public.pfms_can_manage_legacy_team(v_team_id)
    or exists (
      select 1 from public.pfms_legacy_team_staff s
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

create or replace function public.pfms_save_legacy_team_permissions(
  p_assignment_id uuid,
  p_permissions jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
  v_item jsonb;
  v_module_key text;
  v_can_view boolean;
  v_can_edit boolean;
begin
  select s.team_id into v_team_id
  from public.pfms_legacy_team_staff s
  where s.id = p_assignment_id;

  if not found then
    raise exception 'Team staff assignment not found' using errcode = 'P0002';
  end if;

  if not public.pfms_can_manage_legacy_team(v_team_id) then
    raise exception 'Not authorized to change team permissions' using errcode = '42501';
  end if;

  if pg_catalog.jsonb_typeof(p_permissions) is distinct from 'array' then
    raise exception 'Permissions must be supplied as an array' using errcode = '22023';
  end if;

  if pg_catalog.jsonb_array_length(p_permissions) <> 9 then
    raise exception 'Exactly nine module permission entries are required' using errcode = '22023';
  end if;

  if (
    select pg_catalog.count(distinct value ->> 'module_key')
    from pg_catalog.jsonb_array_elements(p_permissions)
  ) <> 9 then
    raise exception 'Duplicate or missing module permission entries are not allowed' using errcode = '22023';
  end if;

  for v_item in
    select value from pg_catalog.jsonb_array_elements(p_permissions)
  loop
    v_module_key := v_item ->> 'module_key';
    if v_module_key not in (
      'squad','training','attendance','finance',
      'events','calendar','matches','analysis','tasks'
    ) or pg_catalog.jsonb_typeof(v_item -> 'can_view') is distinct from 'boolean'
      or pg_catalog.jsonb_typeof(v_item -> 'can_edit') is distinct from 'boolean' then
      raise exception 'Invalid module permission entry' using errcode = '22023';
    end if;

    v_can_view := (v_item ->> 'can_view')::boolean;
    v_can_edit := (v_item ->> 'can_edit')::boolean;
    if v_can_edit and not v_can_view then
      raise exception 'Edit permission requires view permission' using errcode = '22023';
    end if;

    insert into public.pfms_legacy_team_permissions (
      assignment_id, module_key, can_view, can_edit, updated_by, updated_at
    ) values (
      p_assignment_id, v_module_key, v_can_view, v_can_edit, auth.uid(), pg_catalog.now()
    )
    on conflict (assignment_id, module_key)
    do update set
      can_view = excluded.can_view,
      can_edit = excluded.can_edit,
      updated_by = auth.uid(),
      updated_at = pg_catalog.now();
  end loop;
end;
$$;

create or replace function public.pfms_get_my_legacy_team_permissions(
  p_team_id uuid
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
begin
  if not public.pfms_can_access_legacy_team(p_team_id) then
    raise exception 'Not authorized to access team permissions' using errcode = '42501';
  end if;

  return query
  select modules.module_key,
         case when public.pfms_can_manage_legacy_team(p_team_id)
           then true else coalesce(p.can_view, false) end,
         case when public.pfms_can_manage_legacy_team(p_team_id)
           then true else coalesce(p.can_edit, false) end
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
  left join public.pfms_legacy_team_staff s
    on s.team_id = p_team_id
   and s.user_id = auth.uid()
   and s.status = 'active'
  left join public.pfms_legacy_team_permissions p
    on p.assignment_id = s.id
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

revoke all on function public.pfms_has_legacy_team_permission(uuid,text,text) from public, anon;
revoke all on function public.pfms_list_legacy_team_permissions(uuid) from public, anon;
revoke all on function public.pfms_save_legacy_team_permissions(uuid,jsonb) from public, anon;
revoke all on function public.pfms_get_my_legacy_team_permissions(uuid) from public, anon;

grant execute on function public.pfms_has_legacy_team_permission(uuid,text,text) to authenticated;
grant execute on function public.pfms_list_legacy_team_permissions(uuid) to authenticated;
grant execute on function public.pfms_save_legacy_team_permissions(uuid,jsonb) to authenticated;
grant execute on function public.pfms_get_my_legacy_team_permissions(uuid) to authenticated;



create table if not exists public.pfms_legacy_team_tasks (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null
    references public.pfms_legacy_teams(id) on delete cascade,
  title text not null
    check (length(pg_catalog.btrim(title)) between 3 and 160),
  description text
    check (description is null or length(description) <= 3000),
  assigned_to uuid,
  due_date date,
  priority text not null default 'normal'
    check (priority in ('low','normal','high')),
  status text not null default 'open'
    check (status in ('open','in_progress','done','cancelled')),
  completed_at timestamptz,
  created_by uuid not null default auth.uid()
    references auth.users(id) on delete restrict,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint pfms_legacy_team_tasks_done_timestamp check (
    (status = 'done' and completed_at is not null)
    or (status <> 'done' and completed_at is null)
  ),
  constraint pfms_legacy_team_tasks_assignee_same_team_fk
    foreign key (team_id, assigned_to)
    references public.pfms_legacy_team_staff(team_id, user_id)
    on delete set null (assigned_to)
);

create index if not exists pfms_legacy_team_tasks_team_status_due_idx
  on public.pfms_legacy_team_tasks(team_id, status, due_date, created_at desc);
create index if not exists pfms_legacy_team_tasks_assignee_idx
  on public.pfms_legacy_team_tasks(team_id, assigned_to, status);

create or replace function public.pfms_touch_legacy_team_task()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := pg_catalog.now();
  new.updated_by := auth.uid();
  if new.status = 'done' and old.status is distinct from 'done' then
    new.completed_at := pg_catalog.now();
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

revoke all on function public.pfms_touch_legacy_team_task()
  from public, anon, authenticated;

drop trigger if exists pfms_legacy_team_tasks_touch_updated_at
  on public.pfms_legacy_team_tasks;
create trigger pfms_legacy_team_tasks_touch_updated_at
before update on public.pfms_legacy_team_tasks
for each row execute function public.pfms_touch_legacy_team_task();

alter table public.pfms_legacy_team_tasks enable row level security;
alter table public.pfms_legacy_team_tasks force row level security;

drop policy if exists pfms_legacy_team_tasks_select on public.pfms_legacy_team_tasks;
create policy pfms_legacy_team_tasks_select
on public.pfms_legacy_team_tasks
for select to authenticated
using (public.pfms_has_legacy_team_permission(team_id, 'tasks', 'view'));

revoke all on table public.pfms_legacy_team_tasks from public, anon, authenticated;
grant select on table public.pfms_legacy_team_tasks to authenticated;

create or replace function public.pfms_list_legacy_team_tasks(p_team_id uuid)
returns table (
  task_id uuid,
  title text,
  description text,
  assigned_to uuid,
  assigned_name text,
  assigned_username text,
  due_date date,
  priority text,
  status text,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  completed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_team_id is null
     or not public.pfms_has_legacy_team_permission(p_team_id, 'tasks', 'view') then
    raise exception 'Not authorized to view team tasks' using errcode = '42501';
  end if;

  return query
  select t.id, t.title, t.description, t.assigned_to,
         p.full_name, p.username, t.due_date, t.priority, t.status,
         t.created_by, t.created_at, t.updated_at, t.completed_at
  from public.pfms_legacy_team_tasks t
  left join public.profiles p on p.id = t.assigned_to
  where t.team_id = p_team_id
  order by
    case t.status when 'open' then 1 when 'in_progress' then 2 when 'done' then 3 else 4 end,
    t.due_date nulls last,
    t.created_at desc;
end;
$$;

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
    where s.team_id = p_team_id
      and s.user_id = p_assigned_to
      and s.status = 'active'
    for share;
    if not found then
      raise exception 'Task assignee must be active staff of this team'
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
    where s.team_id = v_team_id
      and s.user_id = p_assigned_to
      and s.status = 'active'
    for share;
    if not found then
      raise exception 'Task assignee must be active staff of this team'
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

create or replace function public.pfms_delete_legacy_team_task(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
begin
  select t.team_id into v_team_id
  from public.pfms_legacy_team_tasks t
  where t.id = p_task_id
  for update;

  if not found then
    raise exception 'Team task not found' using errcode = 'P0002';
  end if;
  if not public.pfms_has_legacy_team_permission(v_team_id, 'tasks', 'edit') then
    raise exception 'Not authorized to delete team tasks' using errcode = '42501';
  end if;

  delete from public.pfms_legacy_team_tasks where id = p_task_id;
end;
$$;

revoke all on function public.pfms_list_legacy_team_tasks(uuid) from public, anon;
grant execute on function public.pfms_list_legacy_team_tasks(uuid) to authenticated;
revoke all on function public.pfms_create_legacy_team_task(uuid, text, text, uuid, date, text, text) from public, anon;
grant execute on function public.pfms_create_legacy_team_task(uuid, text, text, uuid, date, text) to authenticated;
revoke all on function public.pfms_update_legacy_team_task(uuid, text, text, uuid, date, text, text) from public, anon;
grant execute on function public.pfms_update_legacy_team_task(uuid, text, text, uuid, date, text, text) to authenticated;
revoke all on function public.pfms_delete_legacy_team_task(uuid) from public, anon;
grant execute on function public.pfms_delete_legacy_team_task(uuid) to authenticated;

comment on table public.pfms_legacy_team_tasks is
  'Shared team tasks. The tasks permission controls visibility and management; assignees are constrained to staff from the owning team.';
