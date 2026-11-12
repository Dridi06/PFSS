-- PFSS Backend Gap Assessment — READ ONLY
-- Run this AFTER 00_schema_security_inventory.sql in the intended NON-PRODUCTION
-- Supabase project. Export every result set before designing migrations.
-- This script deliberately reads metadata only; it does not inspect user rows,
-- emails, names, passwords, tokens, player records or financial records.
-- It creates/alters/drops nothing.

-- 1) Presence of candidate identity and organization models.
with expected(table_name, purpose) as (
  values
    ('profiles','Application profile and legacy global role'),
    ('organizations','Legacy organization model A'),
    ('organization_memberships','Legacy organization memberships A'),
    ('organization_invitations','Legacy invitations A'),
    ('pfms_organizations','Legacy PFMS organization model B'),
    ('pfms_memberships','Legacy PFMS memberships B'),
    ('pfss_players','Tenant player records'),
    ('pfss_teams','Tenant teams'),
    ('pfss_scouting_reports','Tenant scouting reports'),
    ('pfss_media','Tenant media metadata'),
    ('pfss_tasks','Tenant tasks'),
    ('pfss_calendar_events','Tenant calendar'),
    ('pfss_scout_players','Private scout players'),
    ('pfss_scout_reports','Private scout reports'),
    ('pfss_scout_media','Private scout media'),
    ('audit_log','Legacy audit log')
)
select e.table_name, e.purpose,
       (to_regclass('public.' || quote_ident(e.table_name)) is not null) as exists_in_public,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced
from expected e
left join pg_class c on c.oid = to_regclass('public.' || quote_ident(e.table_name))
order by e.table_name;

-- 2) Columns for identity, organization, invitation, audit and PFSS domain tables.
select table_name, ordinal_position, column_name, data_type, udt_name,
       is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and (
    table_name in (
      'profiles','organizations','organization_memberships',
      'organization_invitations','pfms_organizations','pfms_memberships',
      'audit_log','players','scouting_reports'
    )
    or table_name like 'pfss\_%' escape '\'
    or table_name like 'pfms\_%' escape '\'
  )
order by table_name, ordinal_position;

-- 3) All organization-related constraints, foreign keys and unique keys.
select n.nspname as schema_name, t.relname as table_name, con.conname,
       con.contype,
       pg_get_constraintdef(con.oid, true) as definition,
       con.convalidated as validated
from pg_constraint con
join pg_class t on t.oid = con.conrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public'
  and (
    t.relname like 'pfss\_%' escape '\'
    or t.relname like 'pfms\_%' escape '\'
    or t.relname in ('profiles','organizations','organization_memberships',
                     'organization_invitations','audit_log')
  )
order by t.relname, con.contype, con.conname;

-- 4) RLS state and every existing policy on relevant tables.
select c.relname as table_name, c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced,
       coalesce(p.policy_count, 0) as policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join (
  select schemaname, tablename, count(*) as policy_count
  from pg_policies
  where schemaname = 'public'
  group by schemaname, tablename
) p on p.schemaname = n.nspname and p.tablename = c.relname
where n.nspname = 'public'
  and c.relkind in ('r','p')
  and (
    c.relname like 'pfss\_%' escape '\'
    or c.relname like 'pfms\_%' escape '\'
    or c.relname in ('profiles','organizations','organization_memberships',
                     'organization_invitations','audit_log')
  )
order by c.relname;

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname in ('public','storage')
order by schemaname, tablename, policyname;

-- 5) RPC/function inventory including SECURITY DEFINER and search_path.
select n.nspname as schema_name, p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as arguments,
       pg_get_userbyid(p.proowner) as owner,
       p.prosecdef as security_definer,
       p.provolatile as volatility,
       p.proconfig as function_settings,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
       has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public','auth')
  and (
    p.proname like 'pfss\_%' escape '\'
    or p.proname like 'pfms\_%' escape '\'
    or p.proname like '%invitation%'
    or p.proname like '%membership%'
    or p.proname like '%audit%'
  )
order by n.nspname, p.proname, arguments;

-- 6) Triggers, including auth.users profile/invitation triggers.
select n.nspname as schema_name, c.relname as table_name, t.tgname,
       pg_get_triggerdef(t.oid, true) as trigger_definition,
       p.proname as trigger_function
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_proc p on p.oid = t.tgfoid
where not t.tgisinternal
  and (
    n.nspname in ('public','storage')
    or (n.nspname = 'auth' and c.relname = 'users')
  )
order by n.nspname, c.relname, t.tgname;

-- 7) Actual table grants for relevant data tables (metadata only).
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and (
    table_name like 'pfss\_%' escape '\'
    or table_name like 'pfms\_%' escape '\'
    or table_name in ('profiles','organizations','organization_memberships',
                      'organization_invitations','audit_log')
  )
order by table_name, grantee, privilege_type;

-- 8) Storage bucket definitions and object policies (no object names).
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
order by id;

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
order by policyname;

-- 9) Enums and values used by roles, membership, status and organization type.
select n.nspname as schema_name, t.typname as enum_name,
       e.enumsortorder, e.enumlabel
from pg_type t
join pg_namespace n on n.oid = t.typnamespace
join pg_enum e on e.enumtypid = t.oid
where n.nspname in ('public','auth')
  and (
    t.typname ilike '%role%'
    or t.typname ilike '%status%'
    or t.typname ilike '%organization%'
    or t.typname ilike '%member%'
  )
order by t.typname, e.enumsortorder;

-- 10) Approximate row counts only, never record contents.
select schemaname, relname as table_name, n_live_tup as approximate_rows
from pg_stat_user_tables
where schemaname = 'public'
  and (
    relname like 'pfss\_%' escape '\'
    or relname like 'pfms\_%' escape '\'
    or relname in ('profiles','organizations','organization_memberships',
                   'organization_invitations','audit_log')
  )
order by relname;

-- 11) Critical extension availability.
select extname, extversion
from pg_extension
where extname in ('pgcrypto','uuid-ossp')
order by extname;

-- End: export the result sets (especially sections 1–7 and 9) for the final
-- RBAC/membership/invitation migration design.
