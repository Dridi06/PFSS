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
