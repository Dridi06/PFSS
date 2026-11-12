-- PFSS Preflight: read-only schema and security inventory
-- Run in Supabase SQL Editor using a database role permitted to inspect metadata.
-- READ ONLY: this script contains SELECT statements only. It creates/alters/drops nothing.
-- Save/export each result set before preparing migrations.

-- 1) Tables, schemas and RLS flags
select n.nspname as schema_name, c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced,
       pg_catalog.pg_get_userbyid(c.relowner) as table_owner
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid=c.relnamespace
where c.relkind in ('r','p')
  and n.nspname in ('public','storage')
order by n.nspname,c.relname;

-- 2) Columns and defaults (no row data)
select table_schema,table_name,ordinal_position,column_name,
       data_type,udt_name,is_nullable,column_default
from information_schema.columns
where table_schema in ('public','storage')
order by table_schema,table_name,ordinal_position;

-- 3) RLS policies and their predicates
select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
from pg_catalog.pg_policies
where schemaname in ('public','storage')
order by schemaname,tablename,policyname;

-- 4) Constraints and indexes
select n.nspname as schema_name,t.relname as table_name,
       con.conname,pg_catalog.pg_get_constraintdef(con.oid) as definition
from pg_catalog.pg_constraint con
join pg_catalog.pg_class t on t.oid=con.conrelid
join pg_catalog.pg_namespace n on n.oid=t.relnamespace
where n.nspname in ('public','storage')
order by n.nspname,t.relname,con.conname;

select schemaname,tablename,indexname,indexdef
from pg_catalog.pg_indexes
where schemaname in ('public','storage')
order by schemaname,tablename,indexname;

-- 5) Functions, security-definer flag, owner, configuration and definition
select n.nspname as schema_name,p.proname as function_name,
       pg_catalog.pg_get_function_identity_arguments(p.oid) as arguments,
       pg_catalog.pg_get_userbyid(p.proowner) as owner,
       p.prosecdef as security_definer,
       p.provolatile as volatility,
       p.proconfig as function_settings,
       pg_catalog.pg_get_functiondef(p.oid) as definition
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','storage')
order by n.nspname,p.proname,arguments;

-- 6) Triggers (including auth.users triggers)
select n.nspname as schema_name,c.relname as table_name,
       t.tgname,pg_catalog.pg_get_triggerdef(t.oid,true) as definition,
       p.proname as trigger_function
from pg_catalog.pg_trigger t
join pg_catalog.pg_class c on c.oid=t.tgrelid
join pg_catalog.pg_namespace n on n.oid=c.relnamespace
join pg_catalog.pg_proc p on p.oid=t.tgfoid
where not t.tgisinternal
  and (n.nspname in ('public','storage') or (n.nspname='auth' and c.relname='users'))
order by n.nspname,c.relname,t.tgname;

-- 7) Grants on public tables, views, sequences and functions
select table_schema,table_name,grantee,privilege_type
from information_schema.role_table_grants
where table_schema in ('public','storage')
order by table_schema,table_name,grantee,privilege_type;

select routine_schema,routine_name,grantee,privilege_type
from information_schema.role_routine_grants
where routine_schema in ('public','storage')
order by routine_schema,routine_name,grantee,privilege_type;

-- 8) Storage buckets (metadata only)
select id,name,public,file_size_limit,allowed_mime_types
from storage.buckets
order by id;

-- 9) Extensions installed
select e.extname,e.extversion,n.nspname as extension_schema
from pg_catalog.pg_extension e
join pg_catalog.pg_namespace n on n.oid=e.extnamespace
order by e.extname;

-- 10) Approximate row counts for relevant tables (no personal data).
-- Uses catalog statistics so this still works when an optional table is absent.
select schemaname,relname as table_name,n_live_tup as approximate_rows
from pg_catalog.pg_stat_user_tables
where schemaname='public'
  and relname in (
    'profiles','organizations','organization_memberships',
    'organization_invitations','players','scouting_reports',
    'pfms_organizations','pfms_memberships',
    'pfss_scout_players','pfss_scout_reports','pfss_scout_media'
  )
order by relname;
