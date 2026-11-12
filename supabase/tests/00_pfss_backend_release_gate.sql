-- PFSS Supabase Backend Release Gate — READ ONLY
-- Run after the relevant migrations on a non-production test project.
-- Returns PASS / WARN / FAIL rows. Does not modify schema or data.
-- A PASS here is a metadata check, NOT a substitute for two-user RLS tests.

with expected_tables(table_name, criticality) as (
  values
    ('pfss_scout_players','critical'),
    ('pfss_scout_reports','critical'),
    ('pfss_scout_media','critical'),
    ('pfss_players','tenant'),
    ('pfss_teams','tenant'),
    ('pfss_scouting_reports','tenant'),
    ('pfss_media','tenant'),
    ('pfss_tasks','tenant'),
    ('pfss_calendar_events','tenant'),
    ('profiles','identity'),
    ('pfms_organizations','identity'),
    ('pfms_memberships','identity'),
    ('organizations','identity'),
    ('organization_memberships','identity')
),
table_state as (
  select e.table_name, e.criticality,
         c.oid is not null as table_exists,
         coalesce(c.relrowsecurity,false) as rls_enabled,
         coalesce(c.relforcerowsecurity,false) as rls_forced,
         coalesce(p.policy_count,0) as policy_count
  from expected_tables e
  left join pg_class c on c.oid=to_regclass('public.' || quote_ident(e.table_name))
  left join (
    select tablename,count(*) as policy_count
    from pg_policies where schemaname='public'
    group by tablename
  ) p on p.tablename=e.table_name
),
checks as (
  select
    case
      when table_exists and rls_enabled and policy_count > 0 then 'PASS'
      when criticality='critical' and not table_exists then 'FAIL'
      when criticality='critical' and not rls_enabled then 'FAIL'
      when criticality='critical' and policy_count=0 then 'FAIL'
      when criticality='tenant' and table_exists and not rls_enabled then 'FAIL'
      when criticality='tenant' and table_exists and policy_count=0 then 'WARN'
      when criticality='identity' and table_exists and not rls_enabled then 'WARN'
      else 'WARN'
    end as status,
    'table:' || table_name as check_id,
    case
      when not table_exists then 'Table not present in this database.'
      when not rls_enabled then 'RLS is not enabled.'
      when policy_count=0 then 'No RLS policies found; review whether this is intentional.'
      else 'RLS enabled; policies exist. Inspect predicates and test with separate users.'
    end as detail
  from table_state
),
rate_limit_check as (
  select
    case when to_regclass('public.pfss_username_login_limits') is not null
          and exists (
            select 1 from pg_proc p
            join pg_namespace n on n.oid=p.pronamespace
            where n.nspname='public'
              and p.proname='pfss_consume_username_login_limit'
              and pg_get_function_identity_arguments(p.oid)='p_key_hash text, p_max_attempts integer, p_window_seconds integer'
          )
          and coalesce((
            select c.relrowsecurity
            from pg_class c
            where c.oid=to_regclass('public.pfss_username_login_limits')
          ),false)
         then 'PASS' else 'FAIL' end as status,
    'username_login_rate_limit' as check_id,
    'Rate-limit table, RPC signature and RLS flag are checked; verify service_role-only EXECUTE separately.' as detail
),
private_fk_check as (
  select
    case when exists (
      select 1 from pg_constraint
      where conrelid=to_regclass('public.pfss_scout_reports')
        and conname='pfss_scout_reports_owner_player_fkey'
        and contype='f' and convalidated
    ) and exists (
      select 1 from pg_constraint
      where conrelid=to_regclass('public.pfss_scout_media')
        and conname='pfss_scout_media_owner_player_fkey'
        and contype='f' and convalidated
    ) then 'PASS' else 'FAIL' end as status,
    'private_scout_composite_foreign_keys' as check_id,
    'Owner-scoped player references must be validated in both reports and media.' as detail
  where to_regclass('public.pfss_scout_reports') is not null
    and to_regclass('public.pfss_scout_media') is not null
),
bucket_check as (
  select
    case when exists (
      select 1 from storage.buckets
      where id='pfss-scout-private' and public=false
        and file_size_limit <= 52428800
    ) then 'PASS' else 'FAIL' end as status,
    'private_scout_storage_bucket' as check_id,
    'The pfss-scout-private bucket must exist, remain private and enforce a 50 MiB maximum.' as detail
),
private_table_grants_check as (
  select
    case when
      not exists (
        select 1 from information_schema.role_table_grants
        where table_schema='public'
          and table_name in ('pfss_scout_players','pfss_scout_reports','pfss_scout_media')
          and grantee in ('anon','PUBLIC')
      )
      and has_table_privilege('authenticated',to_regclass('public.pfss_scout_players'),'SELECT')
      and has_table_privilege('authenticated',to_regclass('public.pfss_scout_players'),'INSERT')
      and has_table_privilege('authenticated',to_regclass('public.pfss_scout_reports'),'SELECT')
      and has_table_privilege('authenticated',to_regclass('public.pfss_scout_reports'),'INSERT')
      and has_table_privilege('authenticated',to_regclass('public.pfss_scout_media'),'SELECT')
      and has_table_privilege('authenticated',to_regclass('public.pfss_scout_media'),'INSERT')
      and not has_table_privilege('authenticated',to_regclass('public.pfss_scout_media'),'UPDATE')
      then 'PASS' else 'FAIL' end as status,
    'private_scout_table_grants' as check_id,
    'No anon/PUBLIC table grants; authenticated users need scoped CRUD for players/reports and no UPDATE privilege for media metadata.' as detail
  where to_regclass('public.pfss_scout_players') is not null
    and to_regclass('public.pfss_scout_reports') is not null
    and to_regclass('public.pfss_scout_media') is not null
),
rate_limit_grants_check as (
  select
    case when to_regprocedure('public.pfss_consume_username_login_limit(text,integer,integer)') is not null
      and not has_function_privilege('anon',to_regprocedure('public.pfss_consume_username_login_limit(text,integer,integer)'),'EXECUTE')
      and not has_function_privilege('authenticated',to_regprocedure('public.pfss_consume_username_login_limit(text,integer,integer)'),'EXECUTE')
      and has_function_privilege('service_role',to_regprocedure('public.pfss_consume_username_login_limit(text,integer,integer)'),'EXECUTE')
      then 'PASS' else 'FAIL' end as status,
    'username_login_rpc_grants' as check_id,
    'The distributed rate-limit RPC must be executable by service_role only, not anon or authenticated.' as detail
),
storage_policy_check as (
  select
    case when
      (select count(*) from pg_policies
       where schemaname='storage' and tablename='objects'
         and policyname in ('pfss_scout_storage_select','pfss_scout_storage_insert','pfss_scout_storage_delete')) = 3
      then 'PASS' else 'FAIL' end as status,
    'private_scout_storage_policies' as check_id,
    'The private Storage bucket requires owner-folder SELECT, INSERT and DELETE policies.' as detail
),
dual_model_check as (
  select
    case when
      to_regclass('public.pfms_organizations') is not null
      and to_regclass('public.organizations') is not null
      and to_regclass('public.pfms_memberships') is not null
      and to_regclass('public.organization_memberships') is not null
      then 'FAIL'
      else 'WARN'
    end as status,
    'canonical_organization_model' as check_id,
    'If both PFMS and generic organization/membership models exist, choose and document one canonical source before creating final RBAC policies.' as detail
),
rpc_check as (
  select
    case when
      exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
              where n.nspname='public' and p.proname='pfss_admin_list_profiles')
      and exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                  where n.nspname='public' and p.proname='pfms_create_legacy_invitation')
      then 'PASS' else 'WARN' end as status,
    'legacy_admin_rpc_inventory' as check_id,
    'Frontend uses legacy admin and invitation RPCs; inspect their exact signatures, grants, SECURITY DEFINER and search_path before replacement.' as detail
)
select status, check_id, detail from checks
union all select status, check_id, detail from rate_limit_check
union all select status, check_id, detail from private_fk_check
union all select status, check_id, detail from bucket_check
union all select status, check_id, detail from private_table_grants_check
union all select status, check_id, detail from rate_limit_grants_check
union all select status, check_id, detail from storage_policy_check
union all select status, check_id, detail from dual_model_check
union all select status, check_id, detail from rpc_check
order by case status when 'FAIL' then 1 when 'WARN' then 2 else 3 end, check_id;
