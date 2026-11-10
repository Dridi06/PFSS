-- PFSS DATABASE AUDIT (READ ONLY)
-- Run this complete script in Supabase SQL Editor.
-- It returns ONE result table containing columns, RLS status and policies.
-- No data or schema is changed.

with column_info as (
  select
    'COLUMNS'::text as section,
    jsonb_build_object(
      'table_name', table_name,
      'ordinal_position', ordinal_position,
      'column_name', column_name,
      'data_type', data_type,
      'is_nullable', is_nullable,
      'column_default', column_default
    ) as details,
    table_name as sort_table,
    ordinal_position as sort_order
  from information_schema.columns
  where table_schema = 'public'
    and table_name in ('players', 'scouting_reports', 'profiles', 'audit_log', 'rechte')
),
rls_info as (
  select
    'RLS_STATUS'::text as section,
    jsonb_build_object(
      'schema', schemaname,
      'table_name', tablename,
      'rls_enabled', rowsecurity
    ) as details,
    tablename as sort_table,
    0::bigint as sort_order
  from pg_tables
  where schemaname = 'public'
    and tablename in ('players', 'scouting_reports', 'profiles', 'audit_log', 'rechte')
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
    tablename as sort_table,
    0::bigint as sort_order
  from pg_policies
  where schemaname = 'public'
    and tablename in ('players', 'scouting_reports', 'profiles', 'audit_log', 'rechte')
)
select section, details
from (
  select * from column_info
  union all
  select * from rls_info
  union all
  select * from policy_info
) audit
order by
  case section when 'COLUMNS' then 1 when 'RLS_STATUS' then 2 else 3 end,
  sort_table,
  sort_order,
  details::text;
