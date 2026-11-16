-- Keep a training session inside its assigned microcycle week.
-- The cycle assignment RPC validates dates at assignment time; this trigger
-- also protects later session-date changes made through the training RPCs.

create or replace function public.pfms_guard_training_session_cycle_week()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_week_team_id uuid;
  v_week_start date;
  v_week_end date;
begin
  if new.cycle_week_id is null then
    return new;
  end if;

  select w.team_id, w.starts_on, w.ends_on
    into v_week_team_id, v_week_start, v_week_end
  from public.pfms_legacy_training_cycle_weeks w
  where w.id = new.cycle_week_id
  for share;

  if not found
     or v_week_team_id <> new.team_id
     or new.session_date < v_week_start
     or new.session_date > v_week_end then
    raise exception 'Training session must remain within its assigned team cycle week'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.pfms_guard_training_session_cycle_week()
  from public, anon, authenticated;

drop trigger if exists pfms_training_session_cycle_week_guard
  on public.pfms_legacy_training_sessions;

create trigger pfms_training_session_cycle_week_guard
before insert or update of team_id, session_date, cycle_week_id
on public.pfms_legacy_training_sessions
for each row
execute function public.pfms_guard_training_session_cycle_week();

comment on function public.pfms_guard_training_session_cycle_week() is
  'Prevents a scheduled session from leaving its assigned training cycle week or crossing team boundaries.';
