-- Enforce the granular squad permission on direct roster reads.
-- The original policy only checked team membership and therefore allowed a
-- staff member without squad.view to query roster rows directly via PostgREST.

drop policy if exists pfms_legacy_team_players_select
  on public.pfms_legacy_team_players;

create policy pfms_legacy_team_players_select
on public.pfms_legacy_team_players
for select to authenticated
using (
  public.pfms_has_legacy_team_permission(team_id, 'squad', 'view')
);

comment on policy pfms_legacy_team_players_select
  on public.pfms_legacy_team_players is
  'Roster rows are visible only to current team members with squad.view or an authorized team manager.';

-- Calendar and event entries share one physical table. Keep the module
-- boundary at the row level so calendar.view cannot disclose tournaments or
-- events that require the separate events.view permission.
drop policy if exists pfms_legacy_team_calendar_select
  on public.pfms_legacy_team_calendar_events;

create policy pfms_legacy_team_calendar_select
on public.pfms_legacy_team_calendar_events
for select to authenticated
using (
  (
    event_type in ('tournament', 'event')
    and public.pfms_has_legacy_team_permission(team_id, 'events', 'view')
  )
  or
  (
    event_type not in ('tournament', 'event')
    and public.pfms_has_legacy_team_permission(team_id, 'calendar', 'view')
  )
);

comment on policy pfms_legacy_team_calendar_select
  on public.pfms_legacy_team_calendar_events is
  'Shared calendar/event rows are visible only under the permission for their event_type: events.view for tournaments/events, calendar.view for other calendar entries.';
