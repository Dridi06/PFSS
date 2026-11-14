-- PFMS team calendar: training, matches, meetings and other team events.
-- Read access follows team visibility; writes follow team management permissions.

create table if not exists public.pfms_legacy_team_events (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null
    references public.pfms_legacy_teams(id) on delete cascade,
  event_type text not null
    check (event_type in ('training','match','meeting','other')),
  title text not null,
  description text,
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled','cancelled','completed')),
  created_by uuid not null default auth.uid()
    references auth.users(id) on delete restrict,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint pfms_legacy_team_events_title_check
    check (length(pg_catalog.btrim(title)) between 1 and 160),
  constraint pfms_legacy_team_events_description_check
    check (description is null or length(description) <= 8000),
  constraint pfms_legacy_team_events_location_check
    check (location is null or length(location) <= 255),
  constraint pfms_legacy_team_events_time_check
    check (ends_at > starts_at)
);

create index if not exists pfms_legacy_team_events_team_start_idx
  on public.pfms_legacy_team_events(team_id, starts_at);

create index if not exists pfms_legacy_team_events_type_start_idx
  on public.pfms_legacy_team_events(event_type, starts_at);

alter table public.pfms_legacy_team_events enable row level security;
alter table public.pfms_legacy_team_events force row level security;

drop policy if exists pfms_legacy_team_events_select on public.pfms_legacy_team_events;
create policy pfms_legacy_team_events_select
on public.pfms_legacy_team_events
for select to authenticated
using (public.pfms_can_access_legacy_team(team_id));

drop policy if exists pfms_legacy_team_events_insert on public.pfms_legacy_team_events;
create policy pfms_legacy_team_events_insert
on public.pfms_legacy_team_events
for insert to authenticated
with check (
  created_by = auth.uid()
  and public.pfms_can_manage_legacy_team(team_id)
);

drop policy if exists pfms_legacy_team_events_update on public.pfms_legacy_team_events;
create policy pfms_legacy_team_events_update
on public.pfms_legacy_team_events
for update to authenticated
using (public.pfms_can_manage_legacy_team(team_id))
with check (public.pfms_can_manage_legacy_team(team_id));

drop policy if exists pfms_legacy_team_events_delete on public.pfms_legacy_team_events;
create policy pfms_legacy_team_events_delete
on public.pfms_legacy_team_events
for delete to authenticated
using (public.pfms_can_manage_legacy_team(team_id));

revoke all on table public.pfms_legacy_team_events from public, anon;
grant select, insert, update, delete on table public.pfms_legacy_team_events to authenticated;

create or replace function public.pfms_list_legacy_teams_for_calendar()
returns table (
  team_id uuid,
  team_name text,
  organization_id uuid,
  organization_name text,
  age_group text,
  gender text,
  season text,
  can_manage boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    t.id,
    t.team_name,
    t.organization_id,
    o.name,
    t.age_group,
    t.gender,
    t.season,
    public.pfms_can_manage_legacy_team(t.id)
  from public.pfms_legacy_teams t
  join public.organizations o on o.id = t.organization_id
  where public.pfms_can_access_legacy_team(t.id)
    and o.status in ('approved','active')
  order by pg_catalog.lower(o.name), pg_catalog.lower(t.team_name);
$$;

revoke all on function public.pfms_list_legacy_teams_for_calendar() from public, anon;
grant execute on function public.pfms_list_legacy_teams_for_calendar() to authenticated;

create or replace function public.pfms_legacy_team_events_touch_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := pg_catalog.now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

revoke all on function public.pfms_legacy_team_events_touch_updated_at() from public, anon, authenticated;

drop trigger if exists pfms_legacy_team_events_touch_updated_at on public.pfms_legacy_team_events;
create trigger pfms_legacy_team_events_touch_updated_at
before update on public.pfms_legacy_team_events
for each row execute function public.pfms_legacy_team_events_touch_updated_at();

comment on table public.pfms_legacy_team_events is
  'Private team calendar events for training, matches, meetings and other team activities.';
