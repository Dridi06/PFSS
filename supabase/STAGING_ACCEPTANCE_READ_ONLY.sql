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
      (
        select
          pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure('public.pfms_get_my_legacy_team_permissions(uuid)')) ilike '%''squad''%'
          and pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure('public.pfms_get_my_legacy_team_permissions(uuid)')) ilike '%''training''%'
          and pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure('public.pfms_get_my_legacy_team_permissions(uuid)')) ilike '%''attendance''%'
          and pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure('public.pfms_get_my_legacy_team_permissions(uuid)')) ilike '%''finance''%'
          and pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure('public.pfms_get_my_legacy_team_permissions(uuid)')) ilike '%''events''%'
          and pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure('public.pfms_get_my_legacy_team_permissions(uuid)')) ilike '%''calendar''%'
          and pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure('public.pfms_get_my_legacy_team_permissions(uuid)')) ilike '%''matches''%'
          and pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure('public.pfms_get_my_legacy_team_permissions(uuid)')) ilike '%''analysis''%'
          and pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure('public.pfms_get_my_legacy_team_permissions(uuid)')) ilike '%''tasks''%'
      ),
      false
    )
      and coalesce(
        (
          select
            pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure('public.pfms_save_legacy_team_permissions(uuid,jsonb)')) ilike '%<> 9%'
            and pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure('public.pfms_save_legacy_team_permissions(uuid,jsonb)')) ilike '%count(distinct value ->> ''module_key'')%'
            and pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure('public.pfms_save_legacy_team_permissions(uuid,jsonb)')) ilike '%v_can_edit and not v_can_view%'
            and pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure('public.pfms_save_legacy_team_permissions(uuid,jsonb)')) ilike '%''tasks''%'
        ),
        false
      )
      and coalesce(
        (
          select
            pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure('public.pfms_has_legacy_team_permission(uuid,text,text)')) ilike '%''tasks''%'
            and pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure('public.pfms_has_legacy_team_permission(uuid,text,text)')) ilike '%p_action in (''view'',''edit'')%'
        ),
        false
      ),
    'Alle neun Modulschlüssel, eindeutige Neuner-Konfiguration und edit-erfordert-view-Regel müssen in den effektiven Rechtefunktionen vorhanden sein'

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
    'legacy_org_manager_active_organization_gate',
    coalesce((
      select p.prosecdef
        and coalesce(p.proconfig::text, '') like '%search_path=""%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%from public.organizations o%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%o.status in (''approved'', ''active'')%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%m.status = ''active''%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%m.role in (''owner'', ''club_admin'', ''agency_admin'')%'
        and pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
      from pg_catalog.pg_proc p
      where p.oid = pg_catalog.to_regprocedure('public.can_manage_org(uuid)')
    ), false),
    'Organisationsmanager benötigen eine aktive Mitgliedschaft und eine Organisation im Status approved/active'

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
    'legacy_invitation_redemption_status_gate',
    coalesce((
      select p.prosecdef
        and coalesce(p.proconfig::text, '') like '%search_path=""%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%from public.organizations o%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%for share%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%v_org_status not in (''approved'', ''active'')%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%i.redeemed_at is null%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%i.revoked_at is null%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%i.expires_at > pg_catalog.now()%'
        and not pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
        and not exists (
          select 1
          from pg_catalog.aclexplode(
            coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
          ) a
          where a.grantee = 0 and a.privilege_type = 'EXECUTE'
        )
      from pg_catalog.pg_proc p
      where p.oid = pg_catalog.to_regprocedure('public.pfms_apply_legacy_invitation()')
    ), false),
    'Registrierungs-Trigger: aktueller Organisationsstatus und Einmal-Token werden unter Row Locks geprüft; kein Browser-EXECUTE'

  union all
  select
    'profile_authority_columns_protected',
    not coalesce(
      pg_catalog.has_column_privilege(
        'authenticated',
        pg_catalog.to_regclass('public.profiles'),
        'role',
        'UPDATE'
      ), false
    )
      and not coalesce(
        pg_catalog.has_column_privilege(
          'authenticated',
          pg_catalog.to_regclass('public.profiles'),
          'status',
          'UPDATE'
        ), false
      ),
    'authenticated darf profiles.role und profiles.status nicht direkt ändern; Änderungen ausschließlich über serverseitig geschützte RPCs'

  union all
  select
    'legacy_team_access_requires_active_org_membership',
    coalesce((
      select
        p_access.prosecdef
        and coalesce(p_access.proconfig::text, '') like '%search_path=""%'
        and pg_catalog.has_function_privilege('authenticated', p_access.oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('anon', p_access.oid, 'EXECUTE')
        and pg_catalog.pg_get_functiondef(p_access.oid) ilike '%join public.organization_memberships m%'
        and pg_catalog.pg_get_functiondef(p_access.oid) ilike '%m.status = ''active''%'
        and pg_catalog.pg_get_functiondef(p_access.oid) ilike '%m.role = s.role%'
        and pg_catalog.pg_get_functiondef(p_access.oid) ilike '%o.status in (''approved'', ''active'')%'
        and exists (
          select 1
          from pg_catalog.pg_proc p_manage
          where p_manage.oid = pg_catalog.to_regprocedure('public.pfms_can_manage_legacy_team(uuid)')
            and p_manage.prosecdef
            and coalesce(p_manage.proconfig::text, '') like '%search_path=""%'
            and pg_catalog.pg_get_functiondef(p_manage.oid) ilike '%join public.organization_memberships m%'
            and pg_catalog.pg_get_functiondef(p_manage.oid) ilike '%m.role = ''trainer''%'
        )
      from pg_catalog.pg_proc p_access
      where p_access.oid = pg_catalog.to_regprocedure('public.pfms_can_access_legacy_team(uuid)')
    ), false),
    'Teamzugriff verlangt aktiven Organisationsstatus und eine passende aktive Organisationsmitgliedschaft; Trainerrechte sind ebenfalls daran gebunden'

  union all
  select
    'platform_owner_admin_protection',
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
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%public.pfms_platform_owner%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%owner_user_id = p_user_id%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%the platform owner account is protected%'
      from pg_catalog.pg_proc p
      where p.oid = pg_catalog.to_regprocedure('public.pfss_admin_update_profile(uuid,text,text)')
    ), false),
    'Profilverwaltungs-RPC schützt den designierten Plattforminhaber; SECURITY DEFINER, leerer search_path, EXECUTE nur für authenticated'

  union all
  select
    'legacy_owner_updates_serialized',
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
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%from public.organizations o%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%for update%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%the organization must retain at least one active owner%'
      from pg_catalog.pg_proc p
      where p.oid = pg_catalog.to_regprocedure('public.pfms_admin_update_legacy_membership(uuid,text,text)')
    ), false),
    'Mitgliedschafts-RPC sperrt die Organisation vor der Inhaberprüfung; parallele Änderungen werden serialisiert'

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


  union all
  select
    'private_scout_tables_force_rls',
    (
      select count(*) = 3
      from pg_catalog.pg_class c
      where c.oid in (
        pg_catalog.to_regclass('public.pfss_scout_players'),
        pg_catalog.to_regclass('public.pfss_scout_reports'),
        pg_catalog.to_regclass('public.pfss_scout_media')
      )
        and c.relrowsecurity and c.relforcerowsecurity
    ),
    'Alle drei privaten Scout-Tabellen benötigen ENABLE und FORCE ROW LEVEL SECURITY'

  union all
  select
    'private_scout_owner_policies',
    exists (
      select 1 from pg_catalog.pg_policies p
      where p.schemaname = 'public' and p.tablename = 'pfss_scout_players'
        and p.policyname = 'pfss_scout_players_select'
        and p.qual ilike '%owner_id = auth.uid()%'
    )
      and exists (
        select 1 from pg_catalog.pg_policies p
        where p.schemaname = 'public' and p.tablename = 'pfss_scout_reports'
          and p.policyname = 'pfss_scout_reports_select'
          and p.qual ilike '%owner_id = auth.uid()%'
      )
      and exists (
        select 1 from pg_catalog.pg_policies p
        where p.schemaname = 'public' and p.tablename = 'pfss_scout_media'
          and p.policyname = 'pfss_scout_media_select'
          and p.qual ilike '%owner_id = auth.uid()%'
      )
      and exists (
        select 1 from pg_catalog.pg_policies p
        where p.schemaname = 'public' and p.tablename = 'pfss_scout_reports'
          and p.policyname = 'pfss_scout_reports_insert'
          and p.with_check ilike '%p.owner_id = auth.uid()%'
      )
      and exists (
        select 1 from pg_catalog.pg_policies p
        where p.schemaname = 'public' and p.tablename = 'pfss_scout_media'
          and p.policyname = 'pfss_scout_media_insert'
          and p.with_check ilike '%p.owner_id = auth.uid()%'
          and p.with_check ilike '%storage_path%'
      ),
    'Scout-Datensätze sind owner-gebunden; Berichte und Medien dürfen nur eigene Spieler referenzieren'

  union all
  select
    'private_scout_storage_isolated',
    exists (
      select 1 from storage.buckets b
      where b.id = 'pfss-scout-private' and b.public = false
        and b.file_size_limit = 52428800
    )
      and exists (
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
      ),
    'Scout-Medien müssen in einem privaten Bucket liegen und Upload/Lesen auf den eigenen UID-Ordner beschränken'

  union all
  select
    'invitation_redemption_status_guard',
    coalesce((
      select p.prosecdef
        and coalesce(p.proconfig::text, '') like '%search_path=""%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%i.redeemed_at is null%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%i.revoked_at is null%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%i.expires_at > pg_catalog.now()%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%for update%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%for share%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%v_org_status not in (''approved'',''active'')%'
        and not pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
      from pg_catalog.pg_proc p
      where p.oid = pg_catalog.to_regprocedure('public.pfms_apply_legacy_invitation()')
    ), false),
    'Einlösung prüft Einmaligkeit, Widerruf, Ablauf und aktiven Organisationsstatus; Triggerfunktion ist nicht direkt aufrufbar'


  union all
  select
    'team_task_assignee_current_membership',
    coalesce((
      select
        p_create.prosecdef
        and p_update.prosecdef
        and coalesce(p_create.proconfig::text, '') like '%search_path=""%'
        and coalesce(p_update.proconfig::text, '') like '%search_path=""%'
        and pg_catalog.pg_get_functiondef(p_create.oid) ilike '%join public.organization_memberships m%'
        and pg_catalog.pg_get_functiondef(p_create.oid) ilike '%m.status = ''active''%'
        and pg_catalog.pg_get_functiondef(p_create.oid) ilike '%m.role = s.role%'
        and pg_catalog.pg_get_functiondef(p_create.oid) ilike '%o.status in (''approved'', ''active'')%'
        and pg_catalog.pg_get_functiondef(p_update.oid) ilike '%join public.organization_memberships m%'
        and pg_catalog.pg_get_functiondef(p_update.oid) ilike '%m.status = ''active''%'
        and pg_catalog.pg_get_functiondef(p_update.oid) ilike '%m.role = s.role%'
        and pg_catalog.pg_get_functiondef(p_update.oid) ilike '%o.status in (''approved'', ''active'')%'
        and pg_catalog.has_function_privilege('authenticated', p_create.oid, 'EXECUTE')
        and pg_catalog.has_function_privilege('authenticated', p_update.oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('anon', p_create.oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('anon', p_update.oid, 'EXECUTE')
      from pg_catalog.pg_proc p_create
      cross join pg_catalog.pg_proc p_update
      where p_create.oid = pg_catalog.to_regprocedure('public.pfms_create_legacy_team_task(uuid,text,text,uuid,date,text,text)')
        and p_update.oid = pg_catalog.to_regprocedure('public.pfms_update_legacy_team_task(uuid,text,text,uuid,date,text,text)')
    ), false),
    'Task-Zuweisungen verlangen aktive Teamzuordnung, aktive Mitgliedschaft, passende Rolle und aktive Organisation; SECURITY DEFINER mit leerem search_path'

  union all
  select
    'training_cycle_session_date_integrity',
    coalesce((
      select t.tgname = 'pfms_training_session_cycle_week_guard'
        and t.tgenabled in ('O','A')
        and p.prosecdef
        and coalesce(p.proconfig::text, '') like '%search_path=""%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%v_week_team_id <> new.team_id%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%new.session_date < v_week_start%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%new.session_date > v_week_end%'
        and not pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
      from pg_catalog.pg_trigger t
      join pg_catalog.pg_class c on c.oid = t.tgrelid
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      join pg_catalog.pg_proc p on p.oid = t.tgfoid
      where n.nspname = 'public'
        and c.relname = 'pfms_legacy_training_sessions'
        and t.tgname = 'pfms_training_session_cycle_week_guard'
        and not t.tgisinternal
    ), false),
    'Zugeordnete Trainingseinheiten bleiben innerhalb des Datumsbereichs ihrer Team-Mikrozykluswoche; Trigger ist aktiv und nicht direkt aufrufbar'

  union all
  select
    'match_lineup_same_team_integrity',
    coalesce((
      select l.relrowsecurity and l.relforcerowsecurity
        and exists (
          select 1 from pg_catalog.pg_attribute a
          where a.attrelid = l.oid and a.attname = 'team_id'
            and a.attnotnull and not a.attisdropped
        )
        and exists (
          select 1 from pg_catalog.pg_constraint c
          where c.conrelid = l.oid
            and c.conname = 'pfms_legacy_match_lineup_match_team_fk'
            and c.contype = 'f'
        )
        and exists (
          select 1 from pg_catalog.pg_constraint c
          where c.conrelid = l.oid
            and c.conname = 'pfms_legacy_match_lineup_roster_team_fk'
            and c.contype = 'f'
        )
        and exists (
          select 1 from pg_catalog.pg_trigger t
          where t.tgrelid = l.oid
            and t.tgname = 'pfms_legacy_match_lineup_set_team'
            and t.tgenabled in ('O','A')
            and not t.tgisinternal
        )
      from pg_catalog.pg_class l
      where l.oid = pg_catalog.to_regclass('public.pfms_legacy_team_match_lineup')
    ), false),
    'Jede Aufstellungszeile ist per zusammengesetztem Fremdschlüssel an das Team des Spiels und des Kaderdatensatzes gebunden'

  union all
  select
    'team_module_permissions_require_central_membership',
    coalesce((
      select pg_catalog.pg_get_functiondef(p.oid) ilike '%pfms_can_access_legacy_team(p_team_id)%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%''tasks''%'
        and p.prosecdef
        and coalesce(p.proconfig::text, '') like '%search_path=""%'
        and pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'pfms_has_legacy_team_permission'
        and pg_catalog.pg_get_function_identity_arguments(p.oid) = 'p_team_id uuid, p_module_key text, p_action text'
    ), false)
    and coalesce((
      select pg_catalog.pg_get_functiondef(p.oid) ilike '%pfms_can_access_legacy_team(v_team_id)%'
        and p.prosecdef
        and coalesce(p.proconfig::text, '') like '%search_path=""%'
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'pfms_list_legacy_team_permissions'
        and pg_catalog.pg_get_function_identity_arguments(p.oid) = 'p_assignment_id uuid'
    ), false),

    'Modulrechte und Berechtigungslisten setzen die zentrale Prüfung der aktuellen Organisationsmitgliedschaft voraus'

  union all
  select
    'team_permission_matrix_read_write_security',
    coalesce((
      select p.prosecdef
        and coalesce(p.proconfig::text, '') like '%search_path=""%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%pfms_can_access_legacy_team(v_team_id)%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%''tasks''%'
        and pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
      from pg_catalog.pg_proc p
      where p.oid = pg_catalog.to_regprocedure('public.pfms_list_legacy_team_permissions(uuid)')
    ), false)
    and coalesce((
      select p.prosecdef
        and coalesce(p.proconfig::text, '') like '%search_path=""%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%pfms_can_access_legacy_team(p_team_id)%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%''tasks''%'
        and pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
      from pg_catalog.pg_proc p
      where p.oid = pg_catalog.to_regprocedure('public.pfms_get_my_legacy_team_permissions(uuid)')
    ), false)
    and coalesce((
      select p.prosecdef
        and coalesce(p.proconfig::text, '') like '%search_path=""%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%pfms_can_manage_legacy_team(v_team_id)%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%jsonb_array_length(p_permissions) <> 9%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%count(distinct value ->> ''module_key'')%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%v_can_edit and not v_can_view%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%''tasks''%'
        and pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
      from pg_catalog.pg_proc p
      where p.oid = pg_catalog.to_regprocedure('public.pfms_save_legacy_team_permissions(uuid,jsonb)')
    ), false),
    'Lesen der Rechte-Matrix nur mit aktuellem Teamzugriff; Schreiben nur durch Teammanager; neun Module, eindeutige Einträge und edit-erfordert-view'

  union all
  select
    'calendar_read_rpc_event_isolation',
    coalesce((
      select p.prosecdef
        and coalesce(p.proconfig::text, '') like '%search_path=""%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%e.event_type not in (''tournament'', ''event'')%'
        and pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
      from pg_catalog.pg_proc p
      where p.oid = pg_catalog.to_regprocedure('public.pfms_list_legacy_team_calendar(uuid)')
    ), false),
    'SECURITY DEFINER Kalender-Lese-RPC muss Events/Turniere ausschließen und calendar.view erzwingen'

  union all
  select
    'calendar_create_rpc_type_isolation',
    coalesce((
      select p.prosecdef
        and coalesce(p.proconfig::text, '') like '%search_path=""%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%p_event_type not in (''match'',''meeting'',''other'')%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%calendar'', ''edit''%'
        and pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
      from pg_catalog.pg_proc p
      where p.oid = pg_catalog.to_regprocedure('public.pfms_create_legacy_team_calendar_event(uuid,text,text,date,time,time,text,text)')
    ), false),
    'Kalender-RPC darf nur Spiel-, Besprechungs- und sonstige Kalendereinträge anlegen; Events/Turniere gehören ins events-Modul'

  union all
  select
    'calendar_update_rpc_type_isolation',
    coalesce((
      select p.prosecdef
        and coalesce(p.proconfig::text, '') like '%search_path=""%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%v_existing_event_type in (''tournament'', ''event'')%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%p_event_type not in (''match'',''meeting'',''other'')%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%calendar'', ''edit''%'
        and pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
      from pg_catalog.pg_proc p
      where p.oid = pg_catalog.to_regprocedure('public.pfms_update_legacy_team_calendar_event(uuid,text,text,date,time,time,text,text,text)')
    ), false),
    'Kalender-RPC darf Event-/Turnierzeilen weder lesen noch bearbeiten oder in Kalendereinträge umwandeln'

  union all
  select
    'team_access_current_membership_and_role',
    coalesce((
      select p.prosecdef
        and coalesce(p.proconfig::text, '') like '%search_path=""%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%o.status in (''approved'', ''active'')%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%s.status = ''active''%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%m.status = ''active''%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%m.role = s.role%'
        and pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
      from pg_catalog.pg_proc p
      where p.oid = pg_catalog.to_regprocedure('public.pfms_can_access_legacy_team(uuid)')
    ), false),
    'Teamzugriff verlangt aktive Organisation, aktiven Teammitarbeiter und passende aktive Organisationsmitgliedschaft; SECURITY DEFINER mit leerem search_path'

  union all
  select
    'team_management_trainer_role_scope',
    coalesce((
      select p.prosecdef
        and coalesce(p.proconfig::text, '') like '%search_path=""%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%public.can_manage_org(o.id)%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%s.role = ''trainer''%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%m.role = ''trainer''%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%m.status = ''active''%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%o.status in (''approved'', ''active'')%'
        and pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
      from pg_catalog.pg_proc p
      where p.oid = pg_catalog.to_regprocedure('public.pfms_can_manage_legacy_team(uuid)')
    ), false),
    'Teamverwaltung durch Trainer verlangt aktive Mitgliedschaft mit passender Trainerrolle und aktive Organisation'

  union all
  select
    'team_staff_assignment_tenant_scope',
    coalesce((
      select p.prosecdef
        and coalesce(p.proconfig::text, '') like '%search_path=""%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%public.pfms_can_manage_legacy_team(p_team_id)%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%m.organization_id = v_organization_id%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%m.user_id = p_user_id%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%m.status = ''active''%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%m.role = p_role%'
        and pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
      from pg_catalog.pg_proc p
      where p.oid = pg_catalog.to_regprocedure('public.pfms_assign_legacy_team_staff(uuid,uuid,text)')
    ), false),
    'Teammitarbeiter können nur aus der eigenen Organisation mit aktiver Mitgliedschaft und exakt passender Rolle zugeordnet werden'

  union all
  select
    'organization_manager_leadership_protection',
    coalesce((
      select p.prosecdef
        and coalesce(p.proconfig::text, '') like '%search_path=""%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%public.is_admin() or public.can_manage_org(v_organization_id)%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%v_current_role in (''owner'',''club_admin'',''agency_admin'')%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%p_role not in (''scout'',''trainer'',''co_trainer'',''betreuer'',''member'')%'
        and pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
      from pg_catalog.pg_proc p
      where p.oid = pg_catalog.to_regprocedure('public.pfms_update_legacy_org_membership_for_manager(uuid,text,text)')
    ), false),
    'Organisationsmanager dürfen keine Führungsrollen vergeben oder bestehende Inhaber-/Adminrollen ändern'


  union all
  select
    'admin_directory_pagination_rpc_security',
    coalesce((
      select count(*) = 5
        and pg_catalog.bool_and(
          p.prosecdef
          and coalesce(p.proconfig::text, '') like '%search_path=""%'
          and pg_catalog.pg_get_functiondef(p.oid) ilike '%public.pfms_is_admin()%'
          and pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
          and not pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
        )
      from pg_catalog.pg_proc p
      where p.oid in (
        pg_catalog.to_regprocedure('public.pfms_admin_search_legacy_organizations_page(text,text,text,text,integer,integer)'),
        pg_catalog.to_regprocedure('public.pfms_admin_list_legacy_scouts_page(text,text,text,text,integer,integer)'),
        pg_catalog.to_regprocedure('public.pfms_admin_list_legacy_members_page(text,text,text,text,integer,integer)'),
        pg_catalog.to_regprocedure('public.pfss_admin_list_profiles_page(text,text,text,text,integer,integer)'),
        pg_catalog.to_regprocedure('public.pfss_admin_profile_counts()')
      )
    ), false),
    'Alle fünf neuen Admin-Paginierungs-/Zähler-RPCs müssen SECURITY DEFINER mit leerem search_path, pfms_is_admin-Prüfung und EXECUTE nur für authenticated besitzen'

  union all
  select
    'admin_directory_pagination_bounds',
    coalesce((
      select count(*) = 5
        and pg_catalog.bool_and(
          pg_catalog.pg_get_functiondef(p.oid) ilike '%p_limit not between 1 and 100%'
          and pg_catalog.pg_get_functiondef(p.oid) ilike '%p_offset not between 0 and 1000000%'
          and pg_catalog.pg_get_functiondef(p.oid) ilike '%count(*) over ()%'
        )
      from pg_catalog.pg_proc p
      where p.oid in (
        pg_catalog.to_regprocedure('public.pfms_admin_search_legacy_organizations_page(text,text,text,text,integer,integer)'),
        pg_catalog.to_regprocedure('public.pfms_admin_list_legacy_scouts_page(text,text,text,text,integer,integer)'),
        pg_catalog.to_regprocedure('public.pfms_admin_list_legacy_members_page(text,text,text,text,integer,integer)'),
        pg_catalog.to_regprocedure('public.pfss_admin_list_profiles_page(text,text,text,text,integer,integer)'),
        pg_catalog.to_regprocedure('public.pfms_admin_list_legacy_org_members_page(uuid,text,text,text,integer,integer)')
      )
    ), false),
    'Jede Admin-Seitenabfrage muss 1–100 Zeilen und einen begrenzten Offset erzwingen sowie die Gesamtzahl liefern'


  union all
  select
    'admin_system_event_pagination_security',
    coalesce((
      select p.prosecdef
        and coalesce(p.proconfig::text, '') like '%search_path=""%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%public.pfms_is_admin()%'
        and pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
      from pg_catalog.pg_proc p
      where p.oid = pg_catalog.to_regprocedure(
        'public.pfms_admin_list_system_events_page(text,text,text,integer,integer)'
      )
    ), false),
    'Systemereignis-Pagination muss SECURITY DEFINER mit leerem search_path, Admin-Prüfung und EXECUTE nur für authenticated besitzen'

  union all
  select
    'admin_system_event_pagination_bounds',
    coalesce((
      select pg_catalog.pg_get_functiondef(p.oid) ilike '%p_limit not between 1 and 100%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%p_offset not between 0 and 1000000%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%count(*) over ()%'
      from pg_catalog.pg_proc p
      where p.oid = pg_catalog.to_regprocedure(
        'public.pfms_admin_list_system_events_page(text,text,text,integer,integer)'
      )
    ), false),
    'Systemereignis-Pagination muss Seiten auf 1–100 Zeilen begrenzen, Offsets validieren und Gesamtzahl liefern'

  union all
  select
    'admin_org_member_pagination_security',
    coalesce((
      select p.prosecdef
        and coalesce(p.proconfig::text, '') like '%search_path=""%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%public.pfms_is_admin()%'
        and pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
      from pg_catalog.pg_proc p
      where p.oid = pg_catalog.to_regprocedure(
        'public.pfms_admin_list_legacy_org_members_page(uuid,text,text,text,integer,integer)'
      )
    ), false),
    'Organisationsmitglieder-Pagination muss SECURITY DEFINER, leeren search_path, Admin-Prüfung und EXECUTE nur für authenticated besitzen'

  union all
  select
    'admin_org_member_pagination_bounds',
    coalesce((
      select pg_catalog.pg_get_functiondef(p.oid) ilike '%p_limit not between 1 and 100%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%p_offset not between 0 and 1000000%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%p_org_id%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%filtered_count%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%active_count%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%pending_count%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%suspended_count%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%left join page on true%'
      from pg_catalog.pg_proc p
      where p.oid = pg_catalog.to_regprocedure(
        'public.pfms_admin_list_legacy_org_members_page(uuid,text,text,text,integer,integer)'
      )
    ), false),
    'Organisationsmitglieder-Pagination muss Organisation, Filter und begrenzte Seiten samt Gesamtzahl prüfen'


  union all
  select
    'admin_owner_integrity_membership',
    coalesce((
      select p.prosecdef
        and coalesce(p.proconfig::text, '') like '%search_path=""%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%public.is_admin()%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%from public.organizations o%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%for update%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%other_owner.role = ''owner''%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%other_owner.status = ''active''%'
        and pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
      from pg_catalog.pg_proc p
      where p.oid = pg_catalog.to_regprocedure(
        'public.pfms_admin_update_legacy_membership(uuid,text,text)'
      )
    ), false),
    'Admin-Mitgliedschaftsänderungen müssen SECURITY DEFINER, Admin-geschützt und serialisiert sein; die Organisation behält mindestens einen aktiven Inhaber'

  union all
  select
    'admin_platform_owner_profile_protection',
    coalesce((
      select p.prosecdef
        and coalesce(p.proconfig::text, '') like '%search_path=""%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%p_user_id = auth.uid()%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%public.pfms_platform_owner%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%owner_user_id = p_user_id%'
        and pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
      from pg_catalog.pg_proc p
      where p.oid = pg_catalog.to_regprocedure(
        'public.pfss_admin_update_profile(uuid,text,text)'
      )
    ), false),
    'Der designierte Plattforminhaber und das eigene Admin-Profil müssen vor gewöhnlichen Profiländerungen geschützt sein'


  union all
  select
    'legacy_core_security_definer_search_path',
    coalesce((
      select count(*) = 6
        and bool_and(
          p.prosecdef
          and coalesce(p.proconfig::text, '') like '%search_path=""%'
          and pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
          and not pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
          and not exists (
            select 1
            from pg_catalog.aclexplode(
              coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
            ) acl
            where acl.grantee = 0
              and acl.privilege_type = 'EXECUTE'
          )
        )
      from pg_catalog.pg_proc p
      where p.oid in (
        pg_catalog.to_regprocedure('public.pfms_is_admin()'),
        pg_catalog.to_regprocedure('public.pfms_is_org_member(uuid)'),
        pg_catalog.to_regprocedure('public.pfms_admin_search_organizations(text,text)'),
        pg_catalog.to_regprocedure('public.pfms_admin_list_org_members(uuid)'),
        pg_catalog.to_regprocedure('public.pfms_admin_update_membership(uuid,text,text,jsonb)'),
        pg_catalog.to_regprocedure('public.pfms_admin_list_scouts(text)')
      )
    ), false),
    'Kernfunktionen für Admin- und Organisationsberechtigungen müssen SECURITY DEFINER mit leerem search_path und EXECUTE nur für authenticated besitzen'



  union all
  select
    'owner_bootstrap_security_boundary',
    coalesce((
      select
        (
          select count(*) = 2
            and bool_and(
              c.relrowsecurity
              and not pg_catalog.has_table_privilege('authenticated', c.oid, 'SELECT')
              and not pg_catalog.has_table_privilege('authenticated', c.oid, 'INSERT')
              and not pg_catalog.has_table_privilege('authenticated', c.oid, 'UPDATE')
              and not pg_catalog.has_table_privilege('authenticated', c.oid, 'DELETE')
              and not pg_catalog.has_table_privilege('anon', c.oid, 'SELECT')
              and not pg_catalog.has_table_privilege('anon', c.oid, 'INSERT')
              and not pg_catalog.has_table_privilege('anon', c.oid, 'UPDATE')
              and not pg_catalog.has_table_privilege('anon', c.oid, 'DELETE')
            )
          from pg_catalog.pg_class c
          join pg_catalog.pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public'
            and c.relname in ('pfms_platform_owner', 'pfms_owner_bootstrap_requests')
            and c.relkind in ('r', 'p')
        )
        and (
          select count(*) = 3
            and bool_and(
              p.prosecdef
              and coalesce(p.proconfig::text, '') like '%search_path=""%'
            )
          from pg_catalog.pg_proc p
          where p.oid in (
            pg_catalog.to_regprocedure('public.pfms_register_owner_bootstrap_request()'),
            pg_catalog.to_regprocedure('public.pfms_owner_setup_available()'),
            pg_catalog.to_regprocedure('public.pfms_claim_initial_owner(uuid)')
          )
        )
        and not pg_catalog.has_function_privilege(
          'authenticated',
          pg_catalog.to_regprocedure('public.pfms_register_owner_bootstrap_request()'),
          'EXECUTE'
        )
        and not pg_catalog.has_function_privilege(
          'anon',
          pg_catalog.to_regprocedure('public.pfms_register_owner_bootstrap_request()'),
          'EXECUTE'
        )
        and pg_catalog.has_function_privilege(
          'authenticated',
          pg_catalog.to_regprocedure('public.pfms_owner_setup_available()'),
          'EXECUTE'
        )
        and not pg_catalog.has_function_privilege(
          'anon',
          pg_catalog.to_regprocedure('public.pfms_owner_setup_available()'),
          'EXECUTE'
        )
        and pg_catalog.has_function_privilege(
          'service_role',
          pg_catalog.to_regprocedure('public.pfms_claim_initial_owner(uuid)'),
          'EXECUTE'
        )
        and not pg_catalog.has_function_privilege(
          'authenticated',
          pg_catalog.to_regprocedure('public.pfms_claim_initial_owner(uuid)'),
          'EXECUTE'
        )
        and not pg_catalog.has_function_privilege(
          'anon',
          pg_catalog.to_regprocedure('public.pfms_claim_initial_owner(uuid)'),
          'EXECUTE'
        )
        and exists (
          select 1
          from pg_catalog.pg_trigger trg
          join pg_catalog.pg_class rel on rel.oid = trg.tgrelid
          join pg_catalog.pg_namespace ns on ns.oid = rel.relnamespace
          join pg_catalog.pg_proc fn on fn.oid = trg.tgfoid
          where ns.nspname = 'auth'
            and rel.relname = 'users'
            and not trg.tgisinternal
            and fn.proname = 'pfms_register_owner_bootstrap_request'
        )
        and pg_catalog.pg_get_functiondef(
          pg_catalog.to_regprocedure('public.pfms_claim_initial_owner(uuid)')
        ) ilike '%for update%'
        and pg_catalog.pg_get_functiondef(
          pg_catalog.to_regprocedure('public.pfms_claim_initial_owner(uuid)')
        ) ilike '%service_role%'
    ), false),
    'Owner-Bootstrap ist an initiale Signup-Evidenz, RLS, leere search_paths, gesperrte Browser-Tabellenrechte und service_role-only Claim gebunden'

  union all
  select
    'auth_trigger_function_acl',
    coalesce((
      select count(*) = 4
        and bool_and(
          p.prosecdef
          and coalesce(p.proconfig::text, '') like '%search_path=""%'
          and not pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
          and not pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
          and not exists (
            select 1
            from pg_catalog.aclexplode(
              coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
            ) acl
            where acl.grantee = 0
              and acl.privilege_type = 'EXECUTE'
          )
        )
      from pg_catalog.pg_proc p
      where p.oid in (
        pg_catalog.to_regprocedure('public.pfss_sync_signup_username()'),
        pg_catalog.to_regprocedure('public.pfms_provision_new_account()'),
        pg_catalog.to_regprocedure('public.pfms_register_owner_bootstrap_request()'),
        pg_catalog.to_regprocedure('public.pfms_apply_legacy_invitation()')
      )
    ), false),
    'Auth-Triggerfunktionen müssen SECURITY DEFINER mit leerem search_path sein und dürfen nicht direkt durch PUBLIC, anon oder authenticated aufrufbar sein'

  union all
  select
    'admin_legacy_profile_list_rpc_security',
    coalesce((
      select p.prosecdef
        and coalesce(p.proconfig::text, '') like '%search_path=""%'
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%public.is_admin()%'
        and pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
        and not exists (
          select 1
          from pg_catalog.aclexplode(
            coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
          ) acl
          where acl.grantee = 0
            and acl.privilege_type = 'EXECUTE'
        )
      from pg_catalog.pg_proc p
      where p.oid = pg_catalog.to_regprocedure('public.pfss_admin_list_profiles()')
    ), false),
    'Legacy-Profilliste muss SECURITY DEFINER mit leerem search_path und der kanonischen Admin-Prüfung besitzen; EXECUTE nur für authenticated, nicht PUBLIC oder anon'

  union all
  select
    'organization_core_table_write_acl',
    coalesce((
      select count(*) = 3
        and bool_and(
          c.relrowsecurity
          and pg_catalog.has_table_privilege('authenticated', c.oid, 'SELECT')
          and not pg_catalog.has_table_privilege('authenticated', c.oid, 'INSERT')
          and not pg_catalog.has_table_privilege('authenticated', c.oid, 'UPDATE')
          and not pg_catalog.has_table_privilege('authenticated', c.oid, 'DELETE')
          and not pg_catalog.has_table_privilege('authenticated', c.oid, 'TRUNCATE')
          and not pg_catalog.has_table_privilege('authenticated', c.oid, 'REFERENCES')
          and not pg_catalog.has_table_privilege('authenticated', c.oid, 'TRIGGER')
          and not pg_catalog.has_table_privilege('anon', c.oid, 'SELECT')
          and not pg_catalog.has_table_privilege('anon', c.oid, 'INSERT')
          and not pg_catalog.has_table_privilege('anon', c.oid, 'UPDATE')
          and not pg_catalog.has_table_privilege('anon', c.oid, 'DELETE')
          and not pg_catalog.has_table_privilege('anon', c.oid, 'TRUNCATE')
          and not pg_catalog.has_table_privilege('anon', c.oid, 'REFERENCES')
          and not pg_catalog.has_table_privilege('anon', c.oid, 'TRIGGER')
          and not exists (
            select 1
            from pg_catalog.pg_attribute a
            where a.attrelid = c.oid
              and a.attnum > 0
              and not a.attisdropped
              and (
                pg_catalog.has_column_privilege('authenticated', c.oid, a.attnum, 'INSERT')
                or pg_catalog.has_column_privilege('authenticated', c.oid, a.attnum, 'UPDATE')
                or pg_catalog.has_column_privilege('authenticated', c.oid, a.attnum, 'REFERENCES')
                or pg_catalog.has_column_privilege('anon', c.oid, a.attnum, 'SELECT')
                or pg_catalog.has_column_privilege('anon', c.oid, a.attnum, 'INSERT')
                or pg_catalog.has_column_privilege('anon', c.oid, a.attnum, 'UPDATE')
                or pg_catalog.has_column_privilege('anon', c.oid, a.attnum, 'REFERENCES')
              )
          )
          and pg_catalog.has_table_privilege('service_role', c.oid, 'SELECT')
          and pg_catalog.has_table_privilege('service_role', c.oid, 'INSERT')
          and pg_catalog.has_table_privilege('service_role', c.oid, 'UPDATE')
          and pg_catalog.has_table_privilege('service_role', c.oid, 'DELETE')
          and pg_catalog.has_table_privilege('service_role', c.oid, 'TRUNCATE')
          and pg_catalog.has_table_privilege('service_role', c.oid, 'REFERENCES')
          and pg_catalog.has_table_privilege('service_role', c.oid, 'TRIGGER')
        )
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname in (
          'pfms_organizations',
          'pfms_memberships',
          'pfms_scout_profiles'
        )
        and c.relkind in ('r', 'p')
    ), false),
    'Organisationen, Mitgliedschaften und Scout-Profile sind für authenticated nur lesbar; anon hat keinen Zugriff und service_role behält die serverseitigen Schreibrechte'


)
select check_name, passed, details
from checks
order by check_name;
