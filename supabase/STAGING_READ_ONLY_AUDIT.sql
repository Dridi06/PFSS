-- PFMS Staging Database Audit (READ ONLY)
-- Run only in the Supabase SQL Editor for the STAGING project.
-- This script does not create, update or delete any database objects or data.
-- It inventories the competing organization models, auth profiles, RLS, grants,
-- constraints, triggers, relevant functions and private storage configuration.

WITH
target_tables AS (
  SELECT c.oid, n.nspname AS schema_name, c.relname AS table_name,
         c.relrowsecurity AS rls_enabled,
         c.relforcerowsecurity AS rls_forced
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname IN ('public', 'storage')
    AND c.relkind IN ('r', 'p')
),
column_rows AS (
  SELECT 'COLUMNS'::text AS section, t.schema_name || '.' || t.table_name AS object_name,
         jsonb_build_object(
           'column', cols.column_name,
           'position', cols.ordinal_position,
           'type', cols.data_type,
           'udt', cols.udt_name,
           'nullable', cols.is_nullable,
           'default', cols.column_default
         ) AS details
  FROM target_tables t
  JOIN information_schema.columns cols
    ON cols.table_schema = t.schema_name
   AND cols.table_name = t.table_name
),
table_rows AS (
  SELECT 'TABLE_RLS'::text AS section, schema_name || '.' || table_name AS object_name,
         jsonb_build_object('rls_enabled', rls_enabled, 'rls_forced', rls_forced) AS details
  FROM target_tables
),
policy_rows AS (
  SELECT 'POLICIES'::text AS section, schemaname || '.' || tablename AS object_name,
         jsonb_build_object(
           'name', policyname, 'permissive', permissive, 'roles', roles,
           'command', cmd, 'using', qual, 'with_check', with_check
         ) AS details
  FROM pg_policies
  WHERE schemaname IN ('public','storage')
    AND tablename IN (SELECT table_name FROM target_tables)
),
constraint_rows AS (
  SELECT 'CONSTRAINTS'::text AS section,
         n.nspname || '.' || t.relname AS object_name,
         jsonb_build_object(
           'name', con.conname,
           'type', con.contype,
           'definition', pg_get_constraintdef(con.oid, true)
         ) AS details
  FROM pg_constraint con
  JOIN pg_class t ON t.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname IN (SELECT table_name FROM target_tables)
),
trigger_rows AS (
  SELECT 'TRIGGERS'::text AS section,
         n.nspname || '.' || t.relname AS object_name,
         jsonb_build_object(
           'name', trg.tgname,
           'enabled', trg.tgenabled,
           'definition', pg_get_triggerdef(trg.oid, true),
           'function', p.proname,
           'function_definition', pg_get_functiondef(p.oid)
         ) AS details
  FROM pg_trigger trg
  JOIN pg_class t ON t.oid = trg.tgrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  JOIN pg_proc p ON p.oid = trg.tgfoid
  WHERE NOT trg.tgisinternal
    AND (
      (n.nspname = 'public' AND t.relname IN (SELECT table_name FROM target_tables))
      OR (n.nspname = 'auth' AND t.relname = 'users')
    )
),
function_rows AS (
  SELECT 'FUNCTIONS'::text AS section, n.nspname || '.' || p.proname AS object_name,
         jsonb_build_object(
           'arguments', pg_get_function_identity_arguments(p.oid),
           'returns', pg_get_function_result(p.oid),
           'kind', p.prokind,
           'security_definer', p.prosecdef,
           'volatility', p.provolatile,
           'configuration', p.proconfig,
           'definition', CASE WHEN p.prokind = 'a' THEN NULL ELSE pg_get_functiondef(p.oid) END
         ) AS details
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'

),
function_grant_rows AS (
  SELECT
    'FUNCTION_GRANTS'::text AS section,
    n.nspname || '.' || p.proname || '(' ||
      pg_get_function_identity_arguments(p.oid) || ')' AS object_name,
    jsonb_build_object(
      'grantee', coalesce(gr.rolname, 'PUBLIC'),
      'privilege', acl.privilege_type,
      'is_grantable', acl.is_grantable,
      'security_definer', p.prosecdef
    ) AS details
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  CROSS JOIN LATERAL aclexplode(
    coalesce(p.proacl, acldefault('f', p.proowner))
  ) AS acl
  LEFT JOIN pg_roles gr ON gr.oid = acl.grantee
  WHERE n.nspname = 'public'

),
grant_rows AS (
  SELECT 'TABLE_GRANTS'::text AS section,
         table_schema || '.' || table_name AS object_name,
         jsonb_build_object(
           'grantee', grantee, 'privilege', privilege_type,
           'is_grantable', is_grantable
         ) AS details
  FROM information_schema.role_table_grants
  WHERE table_schema IN ('public','storage')
    AND table_name IN (SELECT table_name FROM target_tables)
),
column_grant_rows AS (
  SELECT 'COLUMN_GRANTS'::text AS section,
         n.nspname || '.' || c.relname || '.' || a.attname AS object_name,
         jsonb_build_object(
           'grantee', coalesce(gr.rolname, 'PUBLIC'),
           'privilege', acl.privilege_type,
           'is_grantable', acl.is_grantable
         ) AS details
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  CROSS JOIN LATERAL aclexplode(a.attacl) AS acl
  LEFT JOIN pg_roles gr ON gr.oid = acl.grantee
  WHERE (n.nspname IN ('public', 'storage') OR (n.nspname = 'auth' AND c.relname = 'users'))
    AND a.attnum > 0
    AND NOT a.attisdropped
    AND a.attacl IS NOT NULL
),
relation_inventory_rows AS (
  SELECT 'RELATIONS'::text AS section,
         n.nspname || '.' || c.relname AS object_name,
         jsonb_build_object(
           'kind', c.relkind,
           'owner', pg_get_userbyid(c.relowner),
           'rls_enabled', c.relrowsecurity,
           'rls_forced', c.relforcerowsecurity,
           'relation_options', c.reloptions,
           'security_invoker_view', coalesce(c.reloptions @> ARRAY['security_invoker=true'], false),
           'view_definition', CASE WHEN c.relkind IN ('v', 'm') THEN pg_get_viewdef(c.oid, true) ELSE NULL END
         ) AS details
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE (n.nspname IN ('public', 'storage') OR (n.nspname = 'auth' AND c.relname = 'users'))
    AND c.relkind IN ('r', 'p', 'v', 'm', 'f', 'S')
),
sequence_grant_rows AS (
  SELECT 'SEQUENCE_GRANTS'::text AS section,
         n.nspname || '.' || c.relname AS object_name,
         jsonb_build_object(
           'owner', pg_get_userbyid(c.relowner),
           'grantee', coalesce(gr.rolname, 'PUBLIC'),
           'privilege', acl.privilege_type,
           'is_grantable', acl.is_grantable
         ) AS details
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  CROSS JOIN LATERAL aclexplode(
    coalesce(c.relacl, acldefault('S', c.relowner))
  ) AS acl
  LEFT JOIN pg_roles gr ON gr.oid = acl.grantee
  WHERE n.nspname IN ('public', 'storage', 'auth')
    AND c.relkind = 'S'
),
schema_grant_rows AS (
  SELECT 'SCHEMA_GRANTS'::text AS section,
         n.nspname AS object_name,
         jsonb_build_object(
           'grantee', coalesce(gr.rolname, 'PUBLIC'),
           'privilege', acl.privilege_type,
           'is_grantable', acl.is_grantable
         ) AS details
  FROM pg_namespace n
  CROSS JOIN LATERAL aclexplode(
    coalesce(n.nspacl, acldefault('n', n.nspowner))
  ) AS acl
  LEFT JOIN pg_roles gr ON gr.oid = acl.grantee
  WHERE n.nspname IN ('public', 'storage', 'auth')
),
default_acl_rows AS (
  SELECT 'DEFAULT_PRIVILEGES'::text AS section,
         coalesce(n.nspname, 'GLOBAL') || '.' || pg_get_userbyid(d.defaclrole) AS object_name,
         jsonb_build_object(
           'object_type', d.defaclobjtype,
           'grantee', coalesce(gr.rolname, 'PUBLIC'),
           'privilege', acl.privilege_type,
           'is_grantable', acl.is_grantable
         ) AS details
  FROM pg_default_acl d
  LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
  CROSS JOIN LATERAL aclexplode(d.defaclacl) AS acl
  LEFT JOIN pg_roles gr ON gr.oid = acl.grantee
  WHERE n.nspname IN ('public', 'storage', 'auth')
     OR d.defaclnamespace = 0
),
bucket_rows AS (
  SELECT 'STORAGE_BUCKETS'::text AS section, 'storage.buckets'::text AS object_name,
         jsonb_build_object(
           'id', id, 'name', name, 'public', public,
           'file_size_limit', file_size_limit,
           'allowed_mime_types', allowed_mime_types
         ) AS details
  FROM storage.buckets
),
row_estimate_rows AS (
  SELECT
    'ROW_ESTIMATES'::text AS section,
    t.schema_name || '.' || t.table_name AS object_name,
    jsonb_build_object(
      'live_rows_estimate', coalesce(s.n_live_tup, greatest(c.reltuples, 0)::bigint),
      'dead_rows_estimate', coalesce(s.n_dead_tup, 0),
      'last_analyze', s.last_analyze,
      'last_autoanalyze', s.last_autoanalyze,
      'note', 'PostgreSQL statistics estimate; not an exact row count'
    ) AS details
  FROM target_tables t
  JOIN pg_class c ON c.oid = t.oid
  LEFT JOIN pg_stat_user_tables s ON s.relid = t.oid
  WHERE t.schema_name = 'public'
),
migration_table AS (
  SELECT 'MODEL_COMPARISON'::text AS section,
         'organizations_and_memberships'::text AS object_name,
         jsonb_build_object(
           'legacy_organizations_exists',
             to_regclass('public.organizations') IS NOT NULL,
           'legacy_memberships_exists',
             to_regclass('public.organization_memberships') IS NOT NULL,
           'new_pfms_organizations_exists',
             to_regclass('public.pfms_organizations') IS NOT NULL,
           'new_pfms_memberships_exists',
             to_regclass('public.pfms_memberships') IS NOT NULL,
           'platform_owner_exists',
             to_regclass('public.pfms_platform_owner') IS NOT NULL,
           'profiles_exists',
             to_regclass('public.profiles') IS NOT NULL,
           'supabase_migration_ledger_exists',
             to_regclass('supabase_migrations.schema_migrations') IS NOT NULL,
           'legacy_organizations_rows_estimate',
             (select greatest(reltuples, 0)::bigint from pg_class where oid = to_regclass('public.organizations')),
           'legacy_memberships_rows_estimate',
             (select greatest(reltuples, 0)::bigint from pg_class where oid = to_regclass('public.organization_memberships')),
           'new_pfms_organizations_rows_estimate',
             (select greatest(reltuples, 0)::bigint from pg_class where oid = to_regclass('public.pfms_organizations')),
           'new_pfms_memberships_rows_estimate',
             (select greatest(reltuples, 0)::bigint from pg_class where oid = to_regclass('public.pfms_memberships'))
         ) AS details
)
SELECT section, object_name, details
FROM (
  SELECT * FROM column_rows
  UNION ALL SELECT * FROM table_rows
  UNION ALL SELECT * FROM policy_rows
  UNION ALL SELECT * FROM constraint_rows
  UNION ALL SELECT * FROM trigger_rows
  UNION ALL SELECT * FROM function_rows
  UNION ALL SELECT * FROM function_grant_rows
  UNION ALL SELECT * FROM grant_rows
  UNION ALL SELECT * FROM column_grant_rows
  UNION ALL SELECT * FROM relation_inventory_rows
  UNION ALL SELECT * FROM sequence_grant_rows
  UNION ALL SELECT * FROM schema_grant_rows
  UNION ALL SELECT * FROM default_acl_rows
  UNION ALL SELECT * FROM bucket_rows
  UNION ALL SELECT * FROM row_estimate_rows
  UNION ALL SELECT * FROM migration_table
) audit
ORDER BY section, object_name, details::text;
