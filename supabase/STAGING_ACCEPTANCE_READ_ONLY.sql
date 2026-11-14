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
    'support_ticket_notification_trigger',
    exists (
      select 1
      from pg_catalog.pg_trigger t
      where t.tgrelid = pg_catalog.to_regclass('public.pfms_support_tickets')
        and t.tgname = 'pfms_support_tickets_notify_changes'
        and not t.tgisinternal
        and t.tgenabled <> 'D'
    ),
    'Aktiver AFTER-UPDATE-Trigger für Supportantworten und Ticketabschluss erwartet'

  union all
  select
    'support_notification_trigger_function',
    coalesce((
      exists (
        select 1
        from pg_catalog.pg_proc p
        where p.oid = pg_catalog.to_regprocedure('public.pfms_notify_support_ticket_changes()')
          and p.prosecdef
          and coalesce(p.proconfig::text, '') like '%search_path=""%'
      )
        and not coalesce(pg_catalog.has_function_privilege('authenticated', pg_catalog.to_regprocedure('public.pfms_notify_support_ticket_changes()'), 'EXECUTE'), false)
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

  union all
  select
    'global_player_catalogue_rls',
    coalesce((
      select c.relrowsecurity and c.relforcerowsecurity
      from pg_catalog.pg_class c
      where c.oid = pg_catalog.to_regclass('public.pfms_global_players')
    ), false),
    coalesce((
      select 'RLS=' || c.relrowsecurity || ', FORCE=' || c.relforcerowsecurity
      from pg_catalog.pg_class c
      where c.oid = pg_catalog.to_regclass('public.pfms_global_players')
    ), 'Globaler Spielerkatalog fehlt')

  union all
  select
    'global_catalogue_policy_scope',
    exists (
      select 1 from pg_catalog.pg_policies p
      where p.schemaname = 'public'
        and p.tablename = 'pfms_global_players'
        and p.policyname = 'pfms_global_players_select'
        and p.qual ilike '%pfms_current_user_is_approved()%'
    )
      and exists (
        select 1 from pg_catalog.pg_policies p
        where p.schemaname = 'public'
          and p.tablename = 'pfms_global_players'
          and p.policyname = 'pfms_global_players_insert'
          and p.with_check ilike '%pfms_is_admin()%'
          and p.with_check ilike '%created_by = auth.uid()%'
      )
      and exists (
        select 1 from pg_catalog.pg_policies p
        where p.schemaname = 'public'
          and p.tablename = 'pfms_global_players'
          and p.policyname = 'pfms_global_players_update'
          and p.qual ilike '%pfms_is_admin()%'
          and p.with_check ilike '%pfms_is_admin()%'
      )
      and exists (
        select 1 from pg_catalog.pg_policies p
        where p.schemaname = 'public'
          and p.tablename = 'pfms_global_players'
          and p.policyname = 'pfms_global_players_delete'
          and p.qual ilike '%pfms_is_admin()%'
      ),
    'SELECT nur für freigegebene Konten; INSERT/UPDATE/DELETE nur für Plattformadministratoren'

  union all
  select
    'main_scouting_report_policy_scope',
    exists (
      select 1 from pg_catalog.pg_policies p
      where p.schemaname = 'public'
        and p.tablename = 'pfms_main_scouting_reports'
        and p.policyname = 'pfms_main_scouting_reports_select'
        and p.qual ilike '%author_id = auth.uid()%'
        and p.qual ilike '%pfms_is_admin()%'
    )
      and exists (
        select 1 from pg_catalog.pg_policies p
        where p.schemaname = 'public'
          and p.tablename = 'pfms_main_scouting_reports'
          and p.policyname = 'pfms_main_scouting_reports_insert'
          and p.with_check ilike '%author_id = auth.uid()%'
          and p.with_check ilike '%pfms_current_user_is_approved()%'
      )
      and exists (
        select 1 from pg_catalog.pg_policies p
        where p.schemaname = 'public'
          and p.tablename = 'pfms_main_scouting_reports'
          and p.policyname = 'pfms_main_scouting_reports_update'
          and p.qual ilike '%author_id = auth.uid()%'
          and p.with_check ilike '%pfms_is_admin()%'
      ),
    'Berichte sind verfassereigen; Administratoren dürfen moderieren und verwalten'

  union all
  select
    'main_scouting_reports_rls',
    coalesce((
      select c.relrowsecurity and c.relforcerowsecurity
      from pg_catalog.pg_class c
      where c.oid = pg_catalog.to_regclass('public.pfms_main_scouting_reports')
    ), false),
    coalesce((
      select 'RLS=' || c.relrowsecurity || ', FORCE=' || c.relforcerowsecurity
      from pg_catalog.pg_class c
      where c.oid = pg_catalog.to_regclass('public.pfms_main_scouting_reports')
    ), 'Haupt-Scoutingberichte fehlen')

  union all
  select
    'main_media_owner_rls',
    coalesce((
      select c.relrowsecurity and c.relforcerowsecurity
      from pg_catalog.pg_class c
      where c.oid = pg_catalog.to_regclass('public.pfms_main_media')
    ), false)
      and exists (
        select 1 from pg_catalog.pg_policies p
        where p.schemaname = 'public'
          and p.tablename = 'pfms_main_media'
          and p.policyname = 'pfms_main_media_select_own'
          and p.qual ilike '%owner_id = auth.uid()%'
      ),
    'Private Hauptmedien benötigen FORCE RLS und eine Owner-only SELECT-Policy'

  union all
  select
    'scout_global_player_copy_link',
    exists (
      select 1 from pg_catalog.pg_attribute a
      where a.attrelid = pg_catalog.to_regclass('public.pfss_scout_players')
        and a.attname = 'source_global_player_id'
        and not a.attisdropped
    )
      and exists (
        select 1 from pg_catalog.pg_indexes i
        where i.schemaname = 'public'
          and i.tablename = 'pfss_scout_players'
          and i.indexname = 'pfss_scout_players_owner_global_source_uidx'
      ),
    'Private Scout-Kopien müssen ihre globale Quelle verknüpfen und Duplikate pro Scout verhindern'

  union all
  select
    'legacy_catalogue_import_rpc',
    coalesce(
      pg_catalog.to_regprocedure('public.pfms_import_legacy_catalogue(jsonb,jsonb)') is not null
        and pg_catalog.has_function_privilege('authenticated', pg_catalog.to_regprocedure('public.pfms_import_legacy_catalogue(jsonb,jsonb)'), 'EXECUTE')
        and not pg_catalog.has_function_privilege('anon', pg_catalog.to_regprocedure('public.pfms_import_legacy_catalogue(jsonb,jsonb)'), 'EXECUTE'),
      false
    ),
    'Legacy-Import-RPC muss authenticated aufrufen können; Adminprüfung erfolgt innerhalb der transaktionalen Funktion'
  union all
  select
    'personal_tasks_owner_rls',
    coalesce((
      select c.relrowsecurity and c.relforcerowsecurity
      from pg_catalog.pg_class c
      where c.oid = pg_catalog.to_regclass('public.pfms_personal_tasks')
    ), false)
      and exists (
        select 1 from pg_catalog.pg_policies p
        where p.schemaname = 'public' and p.tablename = 'pfms_personal_tasks'
          and p.policyname = 'pfms_personal_tasks_select_own'
          and p.qual ilike '%owner_id = auth.uid()%'
          and p.qual ilike '%pfms_current_user_is_approved()%'
      )
      and exists (
        select 1 from pg_catalog.pg_policies p
        where p.schemaname = 'public' and p.tablename = 'pfms_personal_tasks'
          and p.policyname = 'pfms_personal_tasks_update_own'
          and p.qual ilike '%owner_id = auth.uid()%'
          and p.with_check ilike '%owner_id = auth.uid()%'
      ),
    'Persönliche Aufgaben benötigen FORCE RLS und Owner-/Approved-Policies'

  union all
  select
    'support_tickets_owner_admin_rls',
    coalesce((
      select c.relrowsecurity and c.relforcerowsecurity
      from pg_catalog.pg_class c
      where c.oid = pg_catalog.to_regclass('public.pfms_support_tickets')
    ), false)
      and exists (
        select 1 from pg_catalog.pg_policies p
        where p.schemaname = 'public' and p.tablename = 'pfms_support_tickets'
          and p.policyname = 'pfms_support_tickets_select_own_or_admin'
          and p.qual ilike '%owner_id = auth.uid()%'
          and p.qual ilike '%pfms_is_admin()%'
      )
      and exists (
        select 1 from pg_catalog.pg_policies p
        where p.schemaname = 'public' and p.tablename = 'pfms_support_tickets'
          and p.policyname = 'pfms_support_tickets_insert_own'
          and p.with_check ilike '%owner_id = auth.uid()%'
          and p.with_check ilike '%pfms_current_user_is_approved()%'
      )
      and exists (
        select 1 from pg_catalog.pg_policies p
        where p.schemaname = 'public' and p.tablename = 'pfms_support_tickets'
          and p.policyname = 'pfms_support_tickets_update_admin'
          and p.qual ilike '%pfms_is_admin()%'
          and p.with_check ilike '%pfms_is_admin()%'
      ),
    'Supporttickets benötigen FORCE RLS: Eigentümer lesen eigene Tickets, Admins verwalten alle'

  union all
  select
    'support_tickets_column_grants',
    coalesce(pg_catalog.has_table_privilege('authenticated', pg_catalog.to_regclass('public.pfms_support_tickets'), 'SELECT'), false)
      and coalesce(pg_catalog.has_table_privilege('authenticated', pg_catalog.to_regclass('public.pfms_support_tickets'), 'INSERT'), false)
      and coalesce(pg_catalog.has_column_privilege('authenticated', pg_catalog.to_regclass('public.pfms_support_tickets'), 'status', 'UPDATE'), false)
      and coalesce(pg_catalog.has_column_privilege('authenticated', pg_catalog.to_regclass('public.pfms_support_tickets'), 'admin_response', 'UPDATE'), false)
      and not coalesce(pg_catalog.has_table_privilege('authenticated', pg_catalog.to_regclass('public.pfms_support_tickets'), 'DELETE'), false)
      and not coalesce(pg_catalog.has_column_privilege('authenticated', pg_catalog.to_regclass('public.pfms_support_tickets'), 'owner_id', 'UPDATE'), false),
    'Browser dürfen Tickets lesen/einreichen und nur Status/Antwortspalten aktualisieren; Löschen und Owner-Wechsel verboten'

  union all
  select
    'main_media_private_bucket',
    exists (
      select 1 from storage.buckets b
      where b.id = 'pfss-scout-private'
        and b.public = false
        and b.file_size_limit = 52428800
    ),
    'Storage-Bucket pfss-scout-private muss privat bleiben und ein 50-MB-Limit haben'

  union all
  select
    'main_media_storage_owner_path',
    exists (
      select 1 from pg_catalog.pg_policies p
      where p.schemaname = 'storage' and p.tablename = 'objects'
        and p.policyname = 'pfss_scout_storage_select'
        and p.qual ilike '%bucket_id%pfss-scout-private%'
        and p.qual ilike '%storage.foldername(name)%auth.uid()%'
    )
      and exists (
        select 1 from pg_catalog.pg_policies p
        where p.schemaname = 'storage' and p.tablename = 'objects'
          and p.policyname = 'pfss_scout_storage_insert'
          and p.with_check ilike '%bucket_id%pfss-scout-private%'
          and p.with_check ilike '%storage.foldername(name)%auth.uid()%'
      )
      and exists (
        select 1 from pg_catalog.pg_policies p
        where p.schemaname = 'storage' and p.tablename = 'objects'
          and p.policyname = 'pfss_scout_storage_delete'
          and p.qual ilike '%bucket_id%pfss-scout-private%'
          and p.qual ilike '%storage.foldername(name)%auth.uid()%'
      ),
    'Storage-Policies müssen den ersten Ordner auf auth.uid() begrenzen; <uid>/main/ bleibt privat'


  union all
  select
    'legacy_org_manager_guard',
    coalesce((
      select p.prosecdef
        and coalesce(p.proconfig::text, '') like '%search_path=""%'
        and pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
        and not exists (
          select 1
          from pg_catalog.aclexplode(
            coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
          ) a
          where a.grantee = 0 and a.privilege_type = 'EXECUTE'
        )
      from pg_catalog.pg_proc p
      where p.oid = pg_catalog.to_regprocedure('public.can_manage_org(uuid)')
    ), false),
    'can_manage_org(uuid): SECURITY DEFINER, leerer search_path, EXECUTE nur für authenticated'

  union all
  select
    'legacy_invitation_manager_authorization',
    coalesce((
      select p.prosecdef
        and coalesce(p.proconfig::text, '') like '%search_path=""%'
        and pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
        and not exists (
          select 1
          from pg_catalog.aclexplode(
            coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
          ) a
          where a.grantee = 0 and a.privilege_type = 'EXECUTE'
        )
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%public.is_admin()%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%public.can_manage_org(p_organization_id)%'
      from pg_catalog.pg_proc p
      where p.oid = pg_catalog.to_regprocedure('public.pfms_create_legacy_invitation(uuid,text,integer)')
    ), false),
    'Einladungs-RPC: SECURITY DEFINER, leerer search_path, authentifiziert, Admin ODER Organisationsleitung; kein PUBLIC/anon EXECUTE'

  union all
  select
    'main_media_metadata_rls',
    coalesce((
      select c.relrowsecurity and c.relforcerowsecurity
      from pg_catalog.pg_class c
      where c.oid = pg_catalog.to_regclass('public.pfms_main_media')
    ), false)
      and exists (
        select 1 from pg_catalog.pg_policies p
        where p.schemaname = 'public' and p.tablename = 'pfms_main_media'
          and p.policyname = 'pfms_main_media_select_own'
          and p.qual ilike '%owner_id = auth.uid()%'
      )
      and exists (
        select 1 from pg_catalog.pg_policies p
        where p.schemaname = 'public' and p.tablename = 'pfms_main_media'
          and p.policyname = 'pfms_main_media_insert_own'
          and p.with_check ilike '%owner_id = auth.uid()%'
          and p.with_check ilike '%auth.uid()%/main/%'
      )
      and exists (
        select 1 from pg_catalog.pg_policies p
        where p.schemaname = 'public' and p.tablename = 'pfms_main_media'
          and p.policyname = 'pfms_main_media_delete_own'
          and p.qual ilike '%owner_id = auth.uid()%'
      ),
    'Medienmetadaten benötigen FORCE RLS und Owner-Bindung für SELECT/INSERT/DELETE'

)
select check_name, passed, details
from checks
order by check_name;
