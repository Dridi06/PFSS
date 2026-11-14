-- PFMS team and staff foundation for the existing legacy club model.
-- Additive migration. Does not create a second organization model.

create table if not exists public.pfms_legacy_teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  team_name text not null,
  age_group text not null default 'Senioren',
  gender text not null default 'Gemischt',
  season text not null,
  division text,
  status text not null default 'active'
    check (status in ('active','archived')),
  created_by uuid not null default auth.uid()
    references auth.users(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint pfms_legacy_teams_name_check
    check (length(pg_catalog.btrim(team_name)) between 1 and 100),
  constraint pfms_legacy_teams_age_group_check
    check (age_group in (
      'Herren','Frauen','U19','U18','U17','U16','U15','U14',
      'U13','U12','U11','U10','U9','U8','U7','Minis','Senioren','Sonstige'
    )),
  constraint pfms_legacy_teams_gender_check
    check (gender in ('Herren','Frauen','Gemischt')),
  constraint pfms_legacy_teams_season_check
    check (length(pg_catalog.btrim(season)) between 4 and 20),
  constraint pfms_legacy_teams_division_check
    check (division is null or length(division) <= 100)
);

create unique index if not exists pfms_legacy_teams_org_name_season_uidx
  on public.pfms_legacy_teams (organization_id, pg_catalog.lower(team_name), season);

create index if not exists pfms_legacy_teams_org_status_idx
  on public.pfms_legacy_teams (organization_id, status, team_name);

create table if not exists public.pfms_legacy_team_staff (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null
    references public.pfms_legacy_teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('trainer','co_trainer','betreuer')),
  status text not null default 'active' check (status in ('active','inactive')),
  assigned_by uuid not null default auth.uid()
    references auth.users(id) on delete restrict,
  assigned_at timestamptz not null default pg_catalog.now(),
  unique (team_id, user_id)
);

create index if not exists pfms_legacy_team_staff_user_idx
  on public.pfms_legacy_team_staff (user_id, status, team_id);

create or replace function public.pfms_touch_legacy_team()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

revoke all on function public.pfms_touch_legacy_team() from public, anon, authenticated;
drop trigger if exists pfms_legacy_teams_touch_updated_at on public.pfms_legacy_teams;
create trigger pfms_legacy_teams_touch_updated_at
before update on public.pfms_legacy_teams
for each row execute function public.pfms_touch_legacy_team();

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
        where t.id = p_team_id
          and public.can_manage_org(t.organization_id)
      )
      or exists (
        select 1
        from public.pfms_legacy_team_staff s
        where s.team_id = p_team_id
          and s.user_id = auth.uid()
          and s.status = 'active'
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
        where t.id = p_team_id
          and public.can_manage_org(t.organization_id)
      )
      or exists (
        select 1
        from public.pfms_legacy_team_staff s
        where s.team_id = p_team_id
          and s.user_id = auth.uid()
          and s.role = 'trainer'
          and s.status = 'active'
      )
    );
$$;

revoke all on function public.pfms_can_access_legacy_team(uuid) from public, anon;
revoke all on function public.pfms_can_manage_legacy_team(uuid) from public, anon;
grant execute on function public.pfms_can_access_legacy_team(uuid) to authenticated;
grant execute on function public.pfms_can_manage_legacy_team(uuid) to authenticated;

alter table public.pfms_legacy_teams enable row level security;
alter table public.pfms_legacy_teams force row level security;
alter table public.pfms_legacy_team_staff enable row level security;
alter table public.pfms_legacy_team_staff force row level security;

drop policy if exists pfms_legacy_teams_select on public.pfms_legacy_teams;
create policy pfms_legacy_teams_select
on public.pfms_legacy_teams
for select to authenticated
using (public.pfms_can_access_legacy_team(id));

drop policy if exists pfms_legacy_team_staff_select on public.pfms_legacy_team_staff;
create policy pfms_legacy_team_staff_select
on public.pfms_legacy_team_staff
for select to authenticated
using (public.pfms_can_access_legacy_team(team_id));

revoke all on table public.pfms_legacy_teams from public, anon, authenticated;
revoke all on table public.pfms_legacy_team_staff from public, anon, authenticated;
grant select on table public.pfms_legacy_teams to authenticated;
grant select on table public.pfms_legacy_team_staff to authenticated;

create or replace function public.pfms_list_my_legacy_teams()
returns table (
  team_id uuid,
  organization_id uuid,
  organization_name text,
  team_name text,
  age_group text,
  gender text,
  season text,
  division text,
  team_status text,
  can_manage boolean,
  staff_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    t.id,
    t.organization_id,
    o.name,
    t.team_name,
    t.age_group,
    t.gender,
    t.season,
    t.division,
    t.status,
    public.pfms_can_manage_legacy_team(t.id),
    count(s.id) filter (where s.status = 'active')
  from public.pfms_legacy_teams t
  join public.organizations o on o.id = t.organization_id
  left join public.pfms_legacy_team_staff s on s.team_id = t.id
  where public.pfms_can_access_legacy_team(t.id)
  group by t.id, o.name
  order by o.name, t.team_name;
$$;

create or replace function public.pfms_list_legacy_team_staff(p_team_id uuid)
returns table (
  assignment_id uuid,
  user_id uuid,
  username text,
  full_name text,
  email text,
  team_role text,
  assignment_status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.pfms_can_access_legacy_team(p_team_id) then
    raise exception 'Not authorized to view this team' using errcode = '42501';
  end if;

  return query
  select
    s.id,
    s.user_id,
    p.username,
    p.full_name,
    u.email,
    s.role,
    s.status
  from public.pfms_legacy_team_staff s
  left join public.profiles p on p.id = s.user_id
  left join auth.users u on u.id = s.user_id
  where s.team_id = p_team_id
  order by case s.role when 'trainer' then 0 when 'co_trainer' then 1 else 2 end,
           pg_catalog.lower(coalesce(p.full_name, p.username, u.email, ''));
end;
$$;

create or replace function public.pfms_list_legacy_team_staff_candidates(p_team_id uuid)
returns table (
  user_id uuid,
  username text,
  full_name text,
  email text,
  organization_role text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
begin
  if not public.pfms_can_manage_legacy_team(p_team_id) then
    raise exception 'Not authorized to manage this team' using errcode = '42501';
  end if;

  select t.organization_id into v_organization_id
  from public.pfms_legacy_teams t
  where t.id = p_team_id;

  if not found then
    raise exception 'Team not found' using errcode = 'P0002';
  end if;

  return query
  select m.user_id, p.username, p.full_name, u.email, m.role
  from public.organization_memberships m
  left join public.profiles p on p.id = m.user_id
  left join auth.users u on u.id = m.user_id
  where m.organization_id = v_organization_id
    and m.status = 'active'
    and m.role in ('trainer','co_trainer','betreuer')
  order by case m.role when 'trainer' then 0 when 'co_trainer' then 1 else 2 end,
           pg_catalog.lower(coalesce(p.full_name, p.username, u.email, ''));
end;
$$;

create or replace function public.pfms_create_legacy_team(
  p_organization_id uuid,
  p_team_name text,
  p_age_group text,
  p_gender text,
  p_season text,
  p_division text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
  v_org_type text;
  v_org_status text;
begin
  if auth.uid() is null or not (public.is_admin() or public.can_manage_org(p_organization_id)) then
    raise exception 'Not authorized to create teams' using errcode = '42501';
  end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p_team_name,''))) not between 1 and 100 then
    raise exception 'Invalid team name' using errcode = '22023';
  end if;
  if p_age_group not in ('Herren','Frauen','U19','U18','U17','U16','U15','U14','U13','U12','U11','U10','U9','U8','U7','Minis','Senioren','Sonstige') then
    raise exception 'Invalid age group' using errcode = '22023';
  end if;
  if p_gender not in ('Herren','Frauen','Gemischt') then
    raise exception 'Invalid gender' using errcode = '22023';
  end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p_season,''))) not between 4 and 20 then
    raise exception 'Invalid season' using errcode = '22023';
  end if;

  select o.organization_type, o.status
  into v_org_type, v_org_status
  from public.organizations o
  where o.id = p_organization_id
  for share;

  if not found or v_org_type <> 'club' or v_org_status not in ('approved','active') then
    raise exception 'An approved or active club is required' using errcode = '42501';
  end if;

  insert into public.pfms_legacy_teams (
    organization_id, team_name, age_group, gender, season, division, created_by
  ) values (
    p_organization_id, pg_catalog.btrim(p_team_name), p_age_group, p_gender,
    pg_catalog.btrim(p_season), nullif(pg_catalog.btrim(coalesce(p_division,'')),''), auth.uid()
  )
  returning id into v_team_id;

  return v_team_id;
end;
$$;

create or replace function public.pfms_update_legacy_team(
  p_team_id uuid,
  p_team_name text,
  p_age_group text,
  p_gender text,
  p_season text,
  p_division text,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.pfms_can_manage_legacy_team(p_team_id) then
    raise exception 'Not authorized to update this team' using errcode = '42501';
  end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p_team_name,''))) not between 1 and 100
     or p_age_group not in ('Herren','Frauen','U19','U18','U17','U16','U15','U14','U13','U12','U11','U10','U9','U8','U7','Minis','Senioren','Sonstige')
     or p_gender not in ('Herren','Frauen','Gemischt')
     or pg_catalog.length(pg_catalog.btrim(coalesce(p_season,''))) not between 4 and 20
     or p_status not in ('active','archived') then
    raise exception 'Invalid team data' using errcode = '22023';
  end if;

  update public.pfms_legacy_teams
  set team_name = pg_catalog.btrim(p_team_name),
      age_group = p_age_group,
      gender = p_gender,
      season = pg_catalog.btrim(p_season),
      division = nullif(pg_catalog.btrim(coalesce(p_division,'')),''),
      status = p_status
  where id = p_team_id;

  if not found then
    raise exception 'Team not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.pfms_assign_legacy_team_staff(
  p_team_id uuid,
  p_user_id uuid,
  p_role text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_staff_id uuid;
begin
  if not public.pfms_can_manage_legacy_team(p_team_id) then
    raise exception 'Not authorized to assign team staff' using errcode = '42501';
  end if;
  if p_user_id is null or p_role not in ('trainer','co_trainer','betreuer') then
    raise exception 'Invalid staff assignment' using errcode = '22023';
  end if;

  select organization_id into v_organization_id
  from public.pfms_legacy_teams
  where id = p_team_id;
  if not found then
    raise exception 'Team not found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.organization_memberships m
    where m.organization_id = v_organization_id
      and m.user_id = p_user_id
      and m.status = 'active'
      and m.role = p_role
  ) then
    raise exception 'Person must have an active organization membership with the same role' using errcode = '42501';
  end if;

  insert into public.pfms_legacy_team_staff (team_id,user_id,role,status,assigned_by)
  values (p_team_id,p_user_id,p_role,'active',auth.uid())
  on conflict (team_id,user_id)
  do update set role = excluded.role, status = 'active', assigned_by = auth.uid(), assigned_at = pg_catalog.now()
  returning id into v_staff_id;

  return v_staff_id;
end;
$$;

create or replace function public.pfms_remove_legacy_team_staff(p_assignment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
begin
  select team_id into v_team_id
  from public.pfms_legacy_team_staff
  where id = p_assignment_id;
  if not found then
    return;
  end if;
  if not public.pfms_can_manage_legacy_team(v_team_id) then
    raise exception 'Not authorized to remove team staff' using errcode = '42501';
  end if;

  delete from public.pfms_legacy_team_staff where id = p_assignment_id;
end;
$$;

revoke all on function public.pfms_list_my_legacy_teams() from public, anon;
revoke all on function public.pfms_list_legacy_team_staff(uuid) from public, anon;
revoke all on function public.pfms_list_legacy_team_staff_candidates(uuid) from public, anon;
revoke all on function public.pfms_create_legacy_team(uuid,text,text,text,text,text) from public, anon;
revoke all on function public.pfms_update_legacy_team(uuid,text,text,text,text,text,text) from public, anon;
revoke all on function public.pfms_assign_legacy_team_staff(uuid,uuid,text) from public, anon;
revoke all on function public.pfms_remove_legacy_team_staff(uuid) from public, anon;

grant execute on function public.pfms_list_my_legacy_teams() to authenticated;
grant execute on function public.pfms_list_legacy_team_staff(uuid) to authenticated;
grant execute on function public.pfms_list_legacy_team_staff_candidates(uuid) to authenticated;
grant execute on function public.pfms_create_legacy_team(uuid,text,text,text,text,text) to authenticated;
grant execute on function public.pfms_update_legacy_team(uuid,text,text,text,text,text,text) to authenticated;
grant execute on function public.pfms_assign_legacy_team_staff(uuid,uuid,text) to authenticated;
grant execute on function public.pfms_remove_legacy_team_staff(uuid) to authenticated;

comment on table public.pfms_legacy_teams is
  'Team configuration scoped to the existing public.organizations model.';
comment on table public.pfms_legacy_team_staff is
  'Trainer, co-trainer and staff assignments scoped to one legacy club team.';
