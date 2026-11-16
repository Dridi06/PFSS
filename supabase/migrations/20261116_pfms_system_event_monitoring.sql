-- PFMS application error monitoring
-- Additive and user-scoped: authenticated users can submit only their own
-- frontend_error events; administrators can read and update event status.
-- Apply in STAGING only after running STAGING_READ_ONLY_AUDIT.sql.

create table if not exists public.pfms_system_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid default auth.uid()
    references auth.users(id) on delete set null,
  event_type text not null default 'frontend_error'
    check (event_type in ('frontend_error')),
  severity text not null default 'error'
    check (severity in ('warning','error','critical')),
  message text not null
    check (length(pg_catalog.btrim(message)) between 1 and 2000),
  route text
    check (route is null or length(route) <= 255),
  details jsonb not null default '{}'::jsonb
    check (pg_catalog.jsonb_typeof(details) = 'object'
      and pg_catalog.pg_column_size(details) <= 16384),
  status text not null default 'open'
    check (status in ('open','in_review','resolved')),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);

create index if not exists pfms_system_events_created_idx
  on public.pfms_system_events(created_at desc);
create index if not exists pfms_system_events_status_idx
  on public.pfms_system_events(status, severity, created_at desc);
create index if not exists pfms_system_events_actor_idx
  on public.pfms_system_events(actor_id, created_at desc);

alter table public.pfms_system_events enable row level security;
alter table public.pfms_system_events force row level security;

drop policy if exists pfms_system_events_insert_own on public.pfms_system_events;
create policy pfms_system_events_insert_own
on public.pfms_system_events
for insert to authenticated
with check (
  actor_id = auth.uid()
  and event_type = 'frontend_error'
  and status = 'open'
  and resolved_at is null
  and resolved_by is null
);

drop policy if exists pfms_system_events_admin_select on public.pfms_system_events;
create policy pfms_system_events_admin_select
on public.pfms_system_events
for select to authenticated
using (public.pfms_is_admin());

drop policy if exists pfms_system_events_admin_update on public.pfms_system_events;
create policy pfms_system_events_admin_update
on public.pfms_system_events
for update to authenticated
using (public.pfms_is_admin())
with check (public.pfms_is_admin());

revoke all on table public.pfms_system_events from public, anon;
grant select, insert, update on table public.pfms_system_events to authenticated;

create or replace function public.pfms_system_events_touch_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

revoke all on function public.pfms_system_events_touch_updated_at() from public, anon, authenticated;

drop trigger if exists pfms_system_events_touch_updated_at on public.pfms_system_events;
create trigger pfms_system_events_touch_updated_at
before update on public.pfms_system_events
for each row execute function public.pfms_system_events_touch_updated_at();

comment on table public.pfms_system_events is
  'Minimal frontend error events with per-user insert and administrator-only review. Never store credentials or tokens.';
