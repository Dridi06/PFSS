-- PFMS system event hardening
-- Column-limited admin updates, immutable event evidence and DB-side secret redaction.
-- Apply in STAGING after 20261116_pfms_system_event_monitoring.sql.

revoke update on table public.pfms_system_events from public, anon, authenticated;
grant update (status, resolved_at, resolved_by)
  on table public.pfms_system_events to authenticated;

create or replace function public.pfms_system_events_guard_changes()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if tg_op = 'INSERT' then
    if new.actor_id is distinct from auth.uid()
       or new.event_type <> 'frontend_error'
       or new.status <> 'open'
       or new.resolved_at is not null
       or new.resolved_by is not null then
      raise exception 'Invalid system event insert' using errcode = '42501';
    end if;
  else
    -- An administrator may triage an event, but cannot rewrite the event
    -- evidence or reassign it to another account.
    if new.id is distinct from old.id
       or new.actor_id is distinct from old.actor_id
       or new.event_type is distinct from old.event_type
       or new.severity is distinct from old.severity
       or new.message is distinct from old.message
       or new.route is distinct from old.route
       or new.details is distinct from old.details
       or new.created_at is distinct from old.created_at then
      raise exception 'System event evidence is immutable' using errcode = '42501';
    end if;

    if new.status is distinct from old.status then
      if new.status = 'resolved' then
        new.resolved_at := pg_catalog.now();
        new.resolved_by := auth.uid();
      else
        new.resolved_at := null;
        new.resolved_by := null;
      end if;
    else
      if new.resolved_at is distinct from old.resolved_at
         or new.resolved_by is distinct from old.resolved_by then
        raise exception 'Resolution metadata is immutable' using errcode = '42501';
      end if;
    end if;
  end if;

  -- Redaction in the browser is helpful but not a security boundary.
  -- Reject common credential/token patterns even for direct API inserts.
  if new.message ~* '(bearer[[:space:]]+[[:alnum:]._~+/=-]{16,}|(access_token|refresh_token|password|authorization|bootstrap_token|client_secret|api_key|apikey|secret)[[:space:]]*[:=])'
     or new.details::text ~* '(bearer[[:space:]]+[[:alnum:]._~+/=-]{16,}|"(access_token|refresh_token|password|authorization|bootstrap_token|client_secret|api_key|apikey|secret)"[[:space:]]*:)'
  then
    raise exception 'Sensitive values are not allowed in system event logs'
      using errcode = '22023';
  end if;

  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

revoke all on function public.pfms_system_events_guard_changes()
  from public, anon, authenticated;

drop trigger if exists pfms_system_events_touch_updated_at on public.pfms_system_events;
drop function if exists public.pfms_system_events_touch_updated_at();

drop trigger if exists pfms_system_events_guard_changes on public.pfms_system_events;
create trigger pfms_system_events_guard_changes
before insert or update on public.pfms_system_events
for each row execute function public.pfms_system_events_guard_changes();

comment on function public.pfms_system_events_guard_changes() is
  'Keeps event evidence immutable, limits admin updates to workflow state and rejects common credential patterns.';
