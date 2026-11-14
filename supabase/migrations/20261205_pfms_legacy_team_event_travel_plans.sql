-- PFMS team event travel and transport planning.
-- One travel plan per tournament/event; writes are only allowed through events.edit RPCs.

create table if not exists public.pfms_legacy_team_event_travel_plans (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  team_id uuid not null,
  origin text not null,
  destination text not null,
  meetup_at timestamptz,
  departure_at timestamptz not null,
  arrival_at timestamptz,
  return_departure_at timestamptz,
  transport_provider text,
  vehicle_label text,
  seat_capacity smallint,
  estimated_cost numeric(10,2) not null default 0,
  notes text,
  created_by uuid not null default auth.uid()
    references auth.users(id) on delete restrict,
  updated_by uuid not null default auth.uid()
    references auth.users(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint pfms_legacy_team_event_travel_event_fk
    foreign key (event_id, team_id)
    references public.pfms_legacy_team_calendar_events(id, team_id)
    on delete cascade,
  constraint pfms_legacy_team_event_travel_origin_check
    check (length(pg_catalog.btrim(origin)) between 2 and 180),
  constraint pfms_legacy_team_event_travel_destination_check
    check (length(pg_catalog.btrim(destination)) between 2 and 180),
  constraint pfms_legacy_team_event_travel_provider_check
    check (transport_provider is null or length(transport_provider) <= 160),
  constraint pfms_legacy_team_event_travel_vehicle_check
    check (vehicle_label is null or length(vehicle_label) <= 100),
  constraint pfms_legacy_team_event_travel_seat_check
    check (seat_capacity is null or seat_capacity between 1 and 80),
  constraint pfms_legacy_team_event_travel_cost_check
    check (estimated_cost between 0 and 100000),
  constraint pfms_legacy_team_event_travel_notes_check
    check (notes is null or length(notes) <= 4000),
  constraint pfms_legacy_team_event_travel_time_check
    check (
      (meetup_at is null or meetup_at <= departure_at)
      and (arrival_at is null or arrival_at >= departure_at)
      and (return_departure_at is null or arrival_at is null or return_departure_at >= arrival_at)
    ),
  unique (event_id)
);

create index if not exists pfms_legacy_team_event_travel_team_idx
  on public.pfms_legacy_team_event_travel_plans(team_id, departure_at);

alter table public.pfms_legacy_team_event_travel_plans enable row level security;
alter table public.pfms_legacy_team_event_travel_plans force row level security;

drop policy if exists pfms_legacy_team_event_travel_select
  on public.pfms_legacy_team_event_travel_plans;
create policy pfms_legacy_team_event_travel_select
on public.pfms_legacy_team_event_travel_plans
for select to authenticated
using (
  public.pfms_has_legacy_team_permission(team_id, 'events', 'view')
);

revoke all on table public.pfms_legacy_team_event_travel_plans
  from public, anon, authenticated;
grant select on table public.pfms_legacy_team_event_travel_plans to authenticated;

create or replace function public.pfms_touch_legacy_team_event_travel_plan()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

revoke all on function public.pfms_touch_legacy_team_event_travel_plan()
  from public, anon, authenticated;

drop trigger if exists pfms_legacy_team_event_travel_plans_touch_updated_at
  on public.pfms_legacy_team_event_travel_plans;
create trigger pfms_legacy_team_event_travel_plans_touch_updated_at
before update on public.pfms_legacy_team_event_travel_plans
for each row execute function public.pfms_touch_legacy_team_event_travel_plan();

create or replace function public.pfms_list_legacy_team_event_travel_plans(
  p_team_id uuid
)
returns table (
  event_id uuid,
  travel_plan_id uuid,
  origin text,
  destination text,
  meetup_at timestamptz,
  departure_at timestamptz,
  arrival_at timestamptz,
  return_departure_at timestamptz,
  transport_provider text,
  vehicle_label text,
  seat_capacity smallint,
  estimated_cost numeric,
  notes text,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_team_id is null
     or not public.pfms_has_legacy_team_permission(p_team_id, 'events', 'view') then
    raise exception 'Not authorized to view team travel plans'
      using errcode = '42501';
  end if;

  return query
  select
    tp.event_id, tp.id, tp.origin, tp.destination,
    tp.meetup_at, tp.departure_at,
    tp.arrival_at, tp.return_departure_at, tp.transport_provider,
    tp.vehicle_label, tp.seat_capacity, tp.estimated_cost, tp.notes, tp.updated_at
  from public.pfms_legacy_team_event_travel_plans tp
  join public.pfms_legacy_team_calendar_events e
    on e.id = tp.event_id and e.team_id = tp.team_id
  left join public.pfms_legacy_team_event_logistics l
    on l.event_id = tp.event_id and l.team_id = tp.team_id
  where tp.team_id = p_team_id
    and e.event_type in ('tournament','event')
  order by tp.departure_at;
end;
$$;

create or replace function public.pfms_save_legacy_team_event_travel_plan(
  p_event_id uuid,
  p_origin text,
  p_destination text,
  p_meetup_at timestamptz default null,
  p_departure_at timestamptz default null,
  p_arrival_at timestamptz default null,
  p_return_departure_at timestamptz default null,
  p_transport_provider text default null,
  p_vehicle_label text default null,
  p_seat_capacity smallint default null,
  p_estimated_cost numeric default 0,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
  v_event_type text;
  v_plan_id uuid;
begin
  select e.team_id, e.event_type
    into v_team_id, v_event_type
  from public.pfms_legacy_team_calendar_events e
  where e.id = p_event_id
  for update;

  if not found then
    raise exception 'Team event not found' using errcode = 'P0002';
  end if;
  if v_event_type not in ('tournament','event') then
    raise exception 'Travel plans are available only for events and tournaments'
      using errcode = '42501';
  end if;
  if not public.pfms_has_legacy_team_permission(v_team_id, 'events', 'edit') then
    raise exception 'Not authorized to manage event travel plans'
      using errcode = '42501';
  end if;

  if p_origin is null
     or pg_catalog.length(pg_catalog.btrim(p_origin)) not between 2 and 180
     or p_destination is null
     or pg_catalog.length(pg_catalog.btrim(p_destination)) not between 2 and 180
     or p_departure_at is null
     or (p_meetup_at is not null and p_meetup_at > p_departure_at)
     or (p_arrival_at is not null and p_arrival_at < p_departure_at)
     or (p_return_departure_at is not null and p_arrival_at is not null and p_return_departure_at < p_arrival_at)
     or (p_transport_provider is not null and pg_catalog.length(p_transport_provider) > 160)
     or (p_vehicle_label is not null and pg_catalog.length(p_vehicle_label) > 100)
     or (p_seat_capacity is not null and p_seat_capacity not between 1 and 80)
     or p_estimated_cost is null or p_estimated_cost not between 0 and 100000
     or (p_notes is not null and pg_catalog.length(p_notes) > 4000) then
    raise exception 'Invalid travel plan data' using errcode = '22023';
  end if;

  insert into public.pfms_legacy_team_event_travel_plans (
    event_id, team_id, origin, destination,
    meetup_at, departure_at, arrival_at, return_departure_at,
    transport_provider, vehicle_label, seat_capacity, estimated_cost,
    notes, created_by, updated_by
  ) values (
    p_event_id, v_team_id, pg_catalog.btrim(p_origin),
    pg_catalog.btrim(p_destination),
    p_meetup_at, p_departure_at, p_arrival_at, p_return_departure_at,
    nullif(pg_catalog.btrim(coalesce(p_transport_provider, '')), ''),
    nullif(pg_catalog.btrim(coalesce(p_vehicle_label, '')), ''),
    p_seat_capacity, p_estimated_cost,
    nullif(pg_catalog.btrim(coalesce(p_notes, '')), ''),
    auth.uid(), auth.uid()
  )
  on conflict (event_id)
  do update set
    origin = excluded.origin,
    destination = excluded.destination,
    meetup_at = excluded.meetup_at,
    departure_at = excluded.departure_at,
    arrival_at = excluded.arrival_at,
    return_departure_at = excluded.return_departure_at,
    transport_provider = excluded.transport_provider,
    vehicle_label = excluded.vehicle_label,
    seat_capacity = excluded.seat_capacity,
    estimated_cost = excluded.estimated_cost,
    notes = excluded.notes,
    updated_by = auth.uid(),
    updated_at = pg_catalog.now()
  returning id into v_plan_id;

  return v_plan_id;
end;
$$;

create or replace function public.pfms_delete_legacy_team_event_travel_plan(
  p_event_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
  v_event_type text;
begin
  select e.team_id, e.event_type
    into v_team_id, v_event_type
  from public.pfms_legacy_team_calendar_events e
  where e.id = p_event_id
  for update;

  if not found then
    raise exception 'Team event not found' using errcode = 'P0002';
  end if;
  if v_event_type not in ('tournament','event')
     or not public.pfms_has_legacy_team_permission(v_team_id, 'events', 'edit') then
    raise exception 'Not authorized to delete event travel plan'
      using errcode = '42501';
  end if;

  delete from public.pfms_legacy_team_event_travel_plans
  where event_id = p_event_id and team_id = v_team_id;
end;
$$;

revoke all on function public.pfms_list_legacy_team_event_travel_plans(uuid)
  from public, anon;
grant execute on function public.pfms_list_legacy_team_event_travel_plans(uuid)
  to authenticated;

revoke all on function public.pfms_save_legacy_team_event_travel_plan(uuid, text, text, timestamptz, timestamptz, timestamptz, timestamptz, text, text, smallint, numeric, text)
  from public, anon;
grant execute on function public.pfms_save_legacy_team_event_travel_plan(uuid, text, text, timestamptz, timestamptz, timestamptz, timestamptz, text, text, smallint, numeric, text)
  to authenticated;

revoke all on function public.pfms_delete_legacy_team_event_travel_plan(uuid)
  from public, anon;
grant execute on function public.pfms_delete_legacy_team_event_travel_plan(uuid)
  to authenticated;

comment on table public.pfms_legacy_team_event_travel_plans is
  'Team-specific transport planning for tournaments/events. Read/write is guarded by events.view/edit; direct browser writes are prohibited.';
