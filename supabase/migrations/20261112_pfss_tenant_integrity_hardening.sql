-- PFSS tenant-integrity hardening
-- Version: 2026-11-12
-- Scope: enforce same-organization relationships for cross-table references.
-- Additive and data-preserving. Does not change RLS policies, grants, roles,
-- helper functions, storage policies, or existing table definitions.
--
-- IMPORTANT:
-- 1. Review on a separate Supabase development project first.
-- 2. This migration intentionally preserves the existing ON DELETE behavior.
-- 3. Granular module permissions are a separate follow-up; do not treat this
--    file alone as a complete security approval.
--
-- Preconditions verified in the live project on 2026-11-12:
-- - All 13 organization-domain tables listed below currently contain 0 rows.
-- - RLS is enabled on all 16 pfss_* tables.
-- - Existing simple foreign keys were inventoried before this migration.
--
-- Parent tables receive UNIQUE (organization_id, id), then child references
-- are replaced with composite foreign keys that include organization_id.

begin;

-- 1) Add composite unique keys to referenced parent tables.
do $$
declare
  v_table text;
  v_constraint text;
begin
  foreach v_table in array array[
    'pfss_players',
    'pfss_teams',
    'pfss_contacts',
    'pfss_scouting_reports',
    'pfss_shortlists',
    'pfss_transfer_cases'
  ]
  loop
    v_constraint := v_table || '_organization_id_id_key';

    if not exists (
      select 1
      from pg_constraint c
      join pg_class r on r.oid = c.conrelid
      join pg_namespace n on n.oid = r.relnamespace
      where n.nspname = 'public'
        and r.relname = v_table
        and c.conname = v_constraint
        and c.contype = 'u'
    ) then
      execute format(
        'alter table public.%I add constraint %I unique (organization_id, id)',
        v_table,
        v_constraint
      );
    end if;
  end loop;
end
$$;

-- 2) Replace simple foreign keys with organization-scoped composite keys.
-- SET NULL is limited to the nullable reference column so organization_id
-- remains intact (PostgreSQL 15+ syntax, supported by current Supabase).

-- Team staff -> team
alter table public.pfss_team_staff
  drop constraint if exists pfss_team_staff_team_id_fkey;
alter table public.pfss_team_staff
  drop constraint if exists pfss_team_staff_org_team_fkey;
alter table public.pfss_team_staff
  add constraint pfss_team_staff_org_team_fkey
  foreign key (organization_id, team_id)
  references public.pfss_teams (organization_id, id)
  on delete cascade;

-- Player team history -> player and optional team
alter table public.pfss_player_team_history
  drop constraint if exists pfss_player_team_history_player_id_fkey;
alter table public.pfss_player_team_history
  drop constraint if exists pfss_player_team_history_org_player_fkey;
alter table public.pfss_player_team_history
  add constraint pfss_player_team_history_org_player_fkey
  foreign key (organization_id, player_id)
  references public.pfss_players (organization_id, id)
  on delete cascade;

alter table public.pfss_player_team_history
  drop constraint if exists pfss_player_team_history_team_id_fkey;
alter table public.pfss_player_team_history
  drop constraint if exists pfss_player_team_history_org_team_fkey;
alter table public.pfss_player_team_history
  add constraint pfss_player_team_history_org_team_fkey
  foreign key (organization_id, team_id)
  references public.pfss_teams (organization_id, id)
  on delete set null (team_id);

-- Scouting reports -> player
alter table public.pfss_scouting_reports
  drop constraint if exists pfss_scouting_reports_player_id_fkey;
alter table public.pfss_scouting_reports
  drop constraint if exists pfss_scouting_reports_org_player_fkey;
alter table public.pfss_scouting_reports
  add constraint pfss_scouting_reports_org_player_fkey
  foreign key (organization_id, player_id)
  references public.pfss_players (organization_id, id)
  on delete cascade;

-- Shortlist entries -> shortlist and player
alter table public.pfss_shortlist_players
  drop constraint if exists pfss_shortlist_players_shortlist_id_fkey;
alter table public.pfss_shortlist_players
  drop constraint if exists pfss_shortlist_players_org_shortlist_fkey;
alter table public.pfss_shortlist_players
  add constraint pfss_shortlist_players_org_shortlist_fkey
  foreign key (organization_id, shortlist_id)
  references public.pfss_shortlists (organization_id, id)
  on delete cascade;

alter table public.pfss_shortlist_players
  drop constraint if exists pfss_shortlist_players_player_id_fkey;
alter table public.pfss_shortlist_players
  drop constraint if exists pfss_shortlist_players_org_player_fkey;
alter table public.pfss_shortlist_players
  add constraint pfss_shortlist_players_org_player_fkey
  foreign key (organization_id, player_id)
  references public.pfss_players (organization_id, id)
  on delete cascade;

-- Contracts -> optional player and contact
alter table public.pfss_contracts
  drop constraint if exists pfss_contracts_player_id_fkey;
alter table public.pfss_contracts
  drop constraint if exists pfss_contracts_org_player_fkey;
alter table public.pfss_contracts
  add constraint pfss_contracts_org_player_fkey
  foreign key (organization_id, player_id)
  references public.pfss_players (organization_id, id)
  on delete set null (player_id);

alter table public.pfss_contracts
  drop constraint if exists pfss_contracts_contact_id_fkey;
alter table public.pfss_contracts
  drop constraint if exists pfss_contracts_org_contact_fkey;
alter table public.pfss_contracts
  add constraint pfss_contracts_org_contact_fkey
  foreign key (organization_id, contact_id)
  references public.pfss_contacts (organization_id, id)
  on delete set null (contact_id);

-- Transfer cases -> optional player and contact
alter table public.pfss_transfer_cases
  drop constraint if exists pfss_transfer_cases_player_id_fkey;
alter table public.pfss_transfer_cases
  drop constraint if exists pfss_transfer_cases_org_player_fkey;
alter table public.pfss_transfer_cases
  add constraint pfss_transfer_cases_org_player_fkey
  foreign key (organization_id, player_id)
  references public.pfss_players (organization_id, id)
  on delete set null (player_id);

alter table public.pfss_transfer_cases
  drop constraint if exists pfss_transfer_cases_contact_id_fkey;
alter table public.pfss_transfer_cases
  drop constraint if exists pfss_transfer_cases_org_contact_fkey;
alter table public.pfss_transfer_cases
  add constraint pfss_transfer_cases_org_contact_fkey
  foreign key (organization_id, contact_id)
  references public.pfss_contacts (organization_id, id)
  on delete set null (contact_id);

-- Tasks -> optional player and transfer case
alter table public.pfss_tasks
  drop constraint if exists pfss_tasks_related_player_id_fkey;
alter table public.pfss_tasks
  drop constraint if exists pfss_tasks_org_player_fkey;
alter table public.pfss_tasks
  add constraint pfss_tasks_org_player_fkey
  foreign key (organization_id, related_player_id)
  references public.pfss_players (organization_id, id)
  on delete set null (related_player_id);

alter table public.pfss_tasks
  drop constraint if exists pfss_tasks_related_transfer_id_fkey;
alter table public.pfss_tasks
  drop constraint if exists pfss_tasks_org_transfer_fkey;
alter table public.pfss_tasks
  add constraint pfss_tasks_org_transfer_fkey
  foreign key (organization_id, related_transfer_id)
  references public.pfss_transfer_cases (organization_id, id)
  on delete set null (related_transfer_id);

-- Calendar events -> optional team and player
alter table public.pfss_calendar_events
  drop constraint if exists pfss_calendar_events_team_id_fkey;
alter table public.pfss_calendar_events
  drop constraint if exists pfss_calendar_events_org_team_fkey;
alter table public.pfss_calendar_events
  add constraint pfss_calendar_events_org_team_fkey
  foreign key (organization_id, team_id)
  references public.pfss_teams (organization_id, id)
  on delete set null (team_id);

alter table public.pfss_calendar_events
  drop constraint if exists pfss_calendar_events_player_id_fkey;
alter table public.pfss_calendar_events
  drop constraint if exists pfss_calendar_events_org_player_fkey;
alter table public.pfss_calendar_events
  add constraint pfss_calendar_events_org_player_fkey
  foreign key (organization_id, player_id)
  references public.pfss_players (organization_id, id)
  on delete set null (player_id);

-- Media -> optional player and scouting report
alter table public.pfss_media
  drop constraint if exists pfss_media_player_id_fkey;
alter table public.pfss_media
  drop constraint if exists pfss_media_org_player_fkey;
alter table public.pfss_media
  add constraint pfss_media_org_player_fkey
  foreign key (organization_id, player_id)
  references public.pfss_players (organization_id, id)
  on delete cascade;

alter table public.pfss_media
  drop constraint if exists pfss_media_report_id_fkey;
alter table public.pfss_media
  drop constraint if exists pfss_media_org_report_fkey;
alter table public.pfss_media
  add constraint pfss_media_org_report_fkey
  foreign key (organization_id, report_id)
  references public.pfss_scouting_reports (organization_id, id)
  on delete cascade;

commit;

-- Verification after execution:
-- SELECT tc.table_name, tc.constraint_name, tc.constraint_type,
--        string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) AS columns
-- FROM information_schema.table_constraints tc
-- JOIN information_schema.key_column_usage kcu
--   ON kcu.constraint_name = tc.constraint_name
--  AND kcu.constraint_schema = tc.constraint_schema
--  AND kcu.table_name = tc.table_name
-- WHERE tc.table_schema = 'public'
--   AND tc.table_name LIKE 'pfss_%'
--   AND (tc.constraint_type = 'UNIQUE' OR tc.constraint_type = 'FOREIGN KEY')
-- GROUP BY tc.table_name, tc.constraint_name, tc.constraint_type
-- ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;
