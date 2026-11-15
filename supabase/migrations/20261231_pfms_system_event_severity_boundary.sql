-- PFMS system-event severity boundary.
-- Browser-submitted frontend telemetry is limited to ordinary error events.
-- Critical severity is reserved for trusted server-side/administrator workflows.

drop policy if exists pfms_system_events_insert_own on public.pfms_system_events;
create policy pfms_system_events_insert_own
on public.pfms_system_events
for insert to authenticated
with check (
  actor_id = auth.uid()
  and event_type = 'frontend_error'
  and severity = 'error'
  and status = 'open'
  and resolved_at is null
  and resolved_by is null
);

create or replace function public.pfms_system_event_severity_guard()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if new.severity is distinct from 'error' then
    raise exception 'Client-submitted frontend events must use error severity'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.pfms_system_event_severity_guard()
  from public, anon, authenticated;

drop trigger if exists pfms_system_event_severity_guard on public.pfms_system_events;
create trigger pfms_system_event_severity_guard
before insert on public.pfms_system_events
for each row execute function public.pfms_system_event_severity_guard();

comment on function public.pfms_system_event_severity_guard() is
  'Restricts authenticated browser-submitted frontend telemetry to error severity; critical severity is not client-forgeable.';
