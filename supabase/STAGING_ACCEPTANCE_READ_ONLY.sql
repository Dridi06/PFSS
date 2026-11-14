-- PFMS Staging Acceptance Audit (READ ONLY)
-- Run after applying the feature-branch migrations to the dedicated STAGING project.
-- This script only reads PostgreSQL catalogs and privilege metadata.

with checks as (
  select
    'team_tasks_rls'::text as check_name,
    coalesce((
      select c.relrowsecurity and c.relforcerowsecurity
      from pg_catalog.pg_class c
      where c.oid = pg_catalog.to_regclass('public.pfms_legacy_team_tasks')
    ), false) as passed,
    coalesce((
      select 'RLS=' || c.relrowsecurity || ', FORCE=' || c.relforcerowsecurity
      from pg_catalog.pg_class c
      where c.oid = pg_catalog.to_regclass('public.pfms_legacy_team_tasks')
    ), 'Teamaufgaben-Tabelle fehlt') as details

  union all
  select
    'notifications_rls',
    coalesce((
      select c.relrowsecurity and c.relforcerowsecurity
      from pg_catalog.pg_class c
      where c.oid = pg_catalog.to_regclass('public.pfms_notifications')
    ), false),
    coalesce((
      select 'RLS=' || c.relrowsecurity || ', FORCE=' || c.relforcerowsecurity
      from pg_catalog.pg_class c
      where c.oid = pg_catalog.to_regclass('public.pfms_notifications')
    ), 'Benachrichtigungstabelle fehlt')

  union all
  select
    'notifications_browser_privileges',
    coalesce(pg_catalog.has_table_privilege('authenticated', pg_catalog.to_regclass('public.pfms_notifications'), 'SELECT'), false)
      and coalesce(pg_catalog.has_column_privilege('authenticated', pg_catalog.to_regclass('public.pfms_notifications'), 'is_read', 'UPDATE'), false)
      and not coalesce(pg_catalog.has_table_privilege('authenticated', pg_catalog.to_regclass('public.pfms_notifications'), 'INSERT'), false)
      and not coalesce(pg_catalog.has_table_privilege('authenticated', pg_catalog.to_regclass('public.pfms_notifications'), 'DELETE'), false)
      and not coalesce(pg_catalog.has_column_privilege('authenticated', pg_catalog.to_regclass('public.pfms_notifications'), 'read_at', 'UPDATE'), false),
    'authenticated: SELECT + UPDATE(is_read) erwartet; INSERT/DELETE/UPDATE(read_at) verboten'

  union all
  select
    'team_tasks_rpc_privileges',
    coalesce(pg_catalog.has_table_privilege('authenticated', pg_catalog.to_regclass('public.pfms_legacy_team_tasks'), 'SELECT'), false)
      and not coalesce(pg_catalog.has_table_privilege('authenticated', pg_catalog.to_regclass('public.pfms_legacy_team_tasks'), 'INSERT'), false)
      and not coalesce(pg_catalog.has_table_privilege('authenticated', pg_catalog.to_regclass('public.pfms_legacy_team_tasks'), 'UPDATE'), false)
      and not coalesce(pg_catalog.has_table_privilege('authenticated', pg_catalog.to_regclass('public.pfms_legacy_team_tasks'), 'DELETE'), false),
    'authenticated: SELECT nur über RLS; INSERT/UPDATE/DELETE ausschließlich per RPC'

  union all
  select
    'task_same_team_assignee_fk',
    exists (
      select 1
      from pg_catalog.pg_constraint c
      where c.conrelid = pg_catalog.to_regclass('public.pfms_legacy_team_tasks')
        and c.conname = 'pfms_legacy_team_tasks_assignee_same_team_fk'
        and pg_catalog.pg_get_constraintdef(c.oid) ilike '%(team_id, assigned_to)%'
        and pg_catalog.pg_get_constraintdef(c.oid) ilike '%pfms_legacy_team_staff(team_id, user_id)%'
    ),
    coalesce((
      select pg_catalog.pg_get_constraintdef(c.oid)
      from pg_catalog.pg_constraint c
      where c.conrelid = pg_catalog.to_regclass('public.pfms_legacy_team_tasks')
        and c.conname = 'pfms_legacy_team_tasks_assignee_same_team_fk'
    ), 'Team-/Mitarbeiter-Fremdschlüssel fehlt')

  union all
  select
    'nine_team_permission_modules',
    coalesce(
      pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure('public.pfms_get_my_legacy_team_permissions(uuid)')) ilike '%tasks%',
      false
    )
      and coalesce(
        pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure('public.pfms_save_legacy_team_permissions(uuid,jsonb)')) ilike '%<> 9%',
        false
      ),
    'tasks-Modul und exakt neun Rechtebereiche erwartet'

  union all
  select
    'team_task_create_rpc',
    coalesce(
      pg_catalog.to_regprocedure('public.pfms_create_legacy_team_task(uuid,text,text,uuid,date,text,text)') is not null
        and pg_catalog.has_function_privilege('authenticated', pg_catalog.to_regprocedure('public.pfms_create_legacy_team_task(uuid,text,text,uuid,date,text,text)'), 'EXECUTE'),
      false
    ),
    'Sieben Parameter; EXECUTE für authenticated erwartet'

  union all
  select
    'notification_trigger',
    exists (
      select 1
      from pg_catalog.pg_trigger t
      where t.tgrelid = pg_catalog.to_regclass('public.pfms_legacy_team_tasks')
        and t.tgname = 'pfms_legacy_team_tasks_notify_changes'
        and not t.tgisinternal
        and t.tgenabled <> 'D'
    ),
    'Aktiver Trigger für Zuweisung und Abschluss von Teamaufgaben erwartet'

  union all
  select
    'notification_trigger_function',
    coalesce((
      exists (
        select 1
        from pg_catalog.pg_proc p
        where p.oid = pg_catalog.to_regprocedure('public.pfms_notify_legacy_team_task_changes()')
          and p.prosecdef
          and coalesce(p.proconfig::text, '') like '%search_path=""%'
      )
        and not coalesce(pg_catalog.has_function_privilege('authenticated', pg_catalog.to_regprocedure('public.pfms_notify_legacy_team_task_changes()'), 'EXECUTE'), false)
    ), false),
    'SECURITY DEFINER mit leerem search_path; kein direkter EXECUTE-Zugriff für authenticated'

  union all
  select
    'notification_own_row_policies',
    exists (
      select 1 from pg_catalog.pg_policies p
      where p.schemaname = 'public'
        and p.tablename = 'pfms_notifications'
        and p.policyname = 'pfms_notifications_select_own'
        and p.qual ilike '%recipient_id = auth.uid()%'
    )
      and exists (
        select 1 from pg_catalog.pg_policies p
        where p.schemaname = 'public'
          and p.tablename = 'pfms_notifications'
          and p.policyname = 'pfms_notifications_update_own'
          and p.qual ilike '%recipient_id = auth.uid()%'
          and p.with_check ilike '%recipient_id = auth.uid()%'
      ),
    'SELECT und UPDATE nur für den eigenen recipient_id erwartet'
)
select check_name, passed, details
from checks
order by check_name;
