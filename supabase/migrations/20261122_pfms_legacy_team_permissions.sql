-- PFMS granular team-module permissions.
-- Trainers/club managers configure operational access for co-trainers and staff.
-- All future team-module RLS policies should call pfms_has_legacy_team_permission.

create table if not exists public.pfms_legacy_team_permissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null
    references public.pfms_legacy_team_staff(id) on delete cascade,
  module_key text not null check (module_key in (
    'squad','training','attendance','finance',
    'events','calendar','matches','analysis'
  )),
  can_view boolean not null default false,
  can_edit boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default pg_catalog.now(),
  constraint pfms_legacy_team_permissions_edit_requires_view
    check (not can_edit or can_view),
  unique (assignment_id, module_key)
);

create index if not exists pfms_legacy_team_permissions_assignment_idx
  on public.pfms_legacy_team_permissions (assignment_id, module_key);

alter table public.pfms_legacy_team_permissions enable row level security;
alter table public.pfms_legacy_team_permissions force row level security;
revoke all on table public.pfms_legacy_team_permissions from public, anon, authenticated;

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
      'events','calendar','matches','analysis'
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
    ('analysis'::text)
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
    else 8
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

  if pg_catalog.jsonb_array_length(p_permissions) <> 8 then
    raise exception 'Exactly eight module permission entries are required' using errcode = '22023';
  end if;

  if (
    select pg_catalog.count(distinct value ->> 'module_key')
    from pg_catalog.jsonb_array_elements(p_permissions)
  ) <> 8 then
    raise exception 'Duplicate or missing module permission entries are not allowed' using errcode = '22023';
  end if;

  for v_item in
    select value from pg_catalog.jsonb_array_elements(p_permissions)
  loop
    v_module_key := v_item ->> 'module_key';
    if v_module_key not in (
      'squad','training','attendance','finance',
      'events','calendar','matches','analysis'
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
    ('analysis'::text)
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
    else 8
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

comment on table public.pfms_legacy_team_permissions is
  'Per-team read/edit rights for co-trainers and team support roles. Future module RLS policies call pfms_has_legacy_team_permission.';
