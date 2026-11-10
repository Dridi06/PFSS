-- PFSS DATABASE AUDIT (READ ONLY)
-- Run this complete script in Supabase SQL Editor.
-- Returns one result table with schema, RLS, policies, foreign keys and access helpers.
-- No data or schema is changed.

with column_info as (
  select
    'COLUMNS'::text as section,
    jsonb_build_object(
      'table_name', c.table_name,
      'ordinal_position', c.ordinal_position,
      'column_name', c.column_name,
      'data_type', c.data_type,
      'is_nullable', c.is_nullable,
      'column_default', c.column_default
    ) as details,
    c.table_name as sort_key,
    c.ordinal_position::bigint as sort_order
  from information_schema.columns c
  where c.table_schema = 'public'
),
rls_info as (
  select
    'RLS_STATUS'::text as section,
    jsonb_build_object(
      'schema', t.schemaname,
      'table_name', t.tablename,
      'rls_enabled', t.rowsecurity,
      'rls_forced', t.forcerowsecurity
    ) as details,
    t.tablename as sort_key,
    0::bigint as sort_order
  from pg_tables t
  join pg_class pc on pc.relname = t.tablename
  join pg_namespace pn on pn.oid = pc.relnamespace and pn.nspname = t.schemaname
  where t.schemaname = 'public'
),
policy_info as (
  select
    'POLICIES'::text as section,
    jsonb_build_object(
      'schema', schemaname,
      'table_name', tablename,
      'policy_name', policyname,
      'permissive', permissive,
      'roles', roles,
      'command', cmd,
      'using_expression', qual,
      'with_check_expression', with_check
    ) as details,
    tablename as sort_key,
    0::bigint as sort_order
  from pg_policies
  where schemaname = 'public'
),
foreign_key_info as (
  select
    'FOREIGN_KEYS'::text as section,
    jsonb_build_object(
      'constraint_name', tc.constraint_name,
      'table_name', tc.table_name,
      'column_name', kcu.column_name,
      'foreign_table_name', ccu.table_name,
      'foreign_column_name', ccu.column_name,
      'delete_rule', rc.delete_rule,
      'update_rule', rc.update_rule
    ) as details,
    tc.table_name as sort_key,
    0::bigint as sort_order
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_catalog = kcu.constraint_catalog
   and tc.constraint_schema = kcu.constraint_schema
   and tc.constraint_name = kcu.constraint_name
  join information_schema.constraint_column_usage ccu
    on ccu.constraint_catalog = tc.constraint_catalog
   and ccu.constraint_schema = tc.constraint_schema
   and ccu.constraint_name = tc.constraint_name
  join information_schema.referential_constraints rc
    on rc.constraint_catalog = tc.constraint_catalog
   and rc.constraint_schema = tc.constraint_schema
   and rc.constraint_name = tc.constraint_name
  where tc.constraint_schema = 'public'
    and tc.constraint_type = 'FOREIGN KEY'
),
helper_info as (
  select
    'ACCESS_HELPERS'::text as section,
    jsonb_build_object(
      'function_name', p.proname,
      'arguments', pg_get_function_identity_arguments(p.oid),
      'returns', pg_get_function_result(p.oid),
      'security_definer', p.prosecdef,
      'definition', pg_get_functiondef(p.oid)
    ) as details,
    p.proname as sort_key,
    0::bigint as sort_order
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'is_admin',
      'is_org_member',
      'can_access_org_team',
      'can_view_shared_scouting_report'
    )
)
select section, details
from (
  select * from column_info
  union all select * from rls_info
  union all select * from policy_info
  union all select * from foreign_key_info
  union all select * from helper_info
) audit
order by
  case section
    when 'COLUMNS' then 1
    when 'RLS_STATUS' then 2
    when 'FOREIGN_KEYS' then 3
    when 'POLICIES' then 4
    else 5
  end,
  sort_key,
  sort_order,
  details::text;
