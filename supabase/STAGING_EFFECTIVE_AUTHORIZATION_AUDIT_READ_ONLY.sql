-- PFMS effective authorization audit (READ ONLY).
-- Run against the isolated Supabase STAGING project after migrations are applied.
-- This query performs no DDL/DML and reports effective catalog state, not assumptions
-- inferred from migration files. Review policy combinations per table and command:
-- permissive policies combine with OR; restrictive policies combine with AND.

WITH target_relations AS (
  SELECT c.oid, n.nspname AS schema_name, c.relname AS relation_name,
         c.relkind, c.relowner, c.relrowsecurity, c.relforcerowsecurity
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname IN ('public', 'storage')
    AND c.relkind IN ('r', 'p')
),
policy_rows AS (
  SELECT
    'RLS_POLICY'::text AS section,
    r.schema_name || '.' || r.relation_name || '.' || p.polname AS object_name,
    jsonb_build_object(
      'command', CASE p.polcmd
        WHEN '*' THEN 'ALL' WHEN 'r' THEN 'SELECT'
        WHEN 'a' THEN 'INSERT' WHEN 'w' THEN 'UPDATE'
        WHEN 'd' THEN 'DELETE' ELSE p.polcmd::text END,
      'permissive', p.polpermissive,
      'roles', ARRAY(
        SELECT CASE WHEN role_oid = 0 THEN 'PUBLIC'
                    ELSE pg_catalog.pg_get_userbyid(role_oid) END
        FROM unnest(p.polroles) AS role_oid
      ),
      'using', pg_catalog.pg_get_expr(p.polqual, p.polrelid, true),
      'with_check', pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid, true)
    ) AS details
  FROM target_relations r
  JOIN pg_catalog.pg_policy p ON p.polrelid = r.oid
),
commands AS (
  SELECT command_code, command_name
  FROM (VALUES
    ('r'::"char", 'SELECT'::text),
    ('a'::"char", 'INSERT'::text),
    ('w'::"char", 'UPDATE'::text),
    ('d'::"char", 'DELETE'::text)
  ) AS command_map(command_code, command_name)
),
policy_summary AS (
  SELECT
    'RLS_EFFECTIVE_SUMMARY'::text AS section,
    r.schema_name || '.' || r.relation_name || '.' || cmd.command_name AS object_name,
    jsonb_build_object(
      'command', cmd.command_name,
      'owner', pg_catalog.pg_get_userbyid(r.relowner),
      'rls_enabled', r.relrowsecurity,
      'rls_forced', r.relforcerowsecurity,
      'policy_count', count(p.oid),
      'permissive_policy_count', count(p.oid) FILTER (WHERE p.polpermissive),
      'restrictive_policy_count', count(p.oid) FILTER (WHERE NOT p.polpermissive),
      'policy_combination', 'Applicable permissive policies OR together; applicable restrictive policies AND together; at least one applicable permissive policy must grant access',
      'no_policy_effect', CASE
        WHEN r.relrowsecurity AND count(p.oid) = 0
          THEN 'RLS denies all rows to roles subject to RLS'
        WHEN NOT r.relrowsecurity
          THEN 'RLS is disabled; table grants are not row-filtered'
        ELSE 'Review role applicability and individual USING/WITH CHECK expressions'
      END
    ) AS details
  FROM target_relations r
  CROSS JOIN commands cmd
  LEFT JOIN pg_catalog.pg_policy p
    ON p.polrelid = r.oid
   AND p.polcmd IN ('*'::"char", cmd.command_code)
  GROUP BY r.oid, r.schema_name, r.relation_name, r.relowner,
           r.relrowsecurity, r.relforcerowsecurity,
           cmd.command_code, cmd.command_name
),
trigger_rows AS (
  SELECT
    'TRIGGER_EFFECTIVE'::text AS section,
    n.nspname || '.' || c.relname || '.' || t.tgname AS object_name,
    jsonb_build_object(
      'enabled_code', t.tgenabled,
      'enabled_meaning', CASE t.tgenabled
        WHEN 'O' THEN 'origin and local'
        WHEN 'R' THEN 'replica'
        WHEN 'A' THEN 'always'
        WHEN 'D' THEN 'disabled'
        ELSE 'unknown' END,
      'definition', pg_catalog.pg_get_triggerdef(t.oid, true),
      'function', pn.nspname || '.' || p.proname || '(' ||
        pg_catalog.pg_get_function_identity_arguments(p.oid) || ')',
      'function_security_definer', p.prosecdef,
      'function_search_path', p.proconfig,
      'function_owner', pg_catalog.pg_get_userbyid(p.proowner),
      'direct_execute_anon', pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE'),
      'direct_execute_authenticated', pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE'),
      'note', 'Triggers execute through PostgreSQL trigger dispatch; direct client EXECUTE is not required'
    ) AS details
  FROM pg_catalog.pg_trigger t
  JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_catalog.pg_proc p ON p.oid = t.tgfoid
  JOIN pg_catalog.pg_namespace pn ON pn.oid = p.pronamespace
  WHERE NOT t.tgisinternal
    AND (
      (n.nspname IN ('public', 'storage') AND c.relkind IN ('r', 'p'))
      OR (n.nspname = 'auth' AND c.relname = 'users')
    )
),
function_rows AS (
  SELECT
    'RPC_EFFECTIVE'::text AS section,
    n.nspname || '.' || p.proname || '(' ||
      pg_catalog.pg_get_function_identity_arguments(p.oid) || ')' AS object_name,
    jsonb_build_object(
      'return_type', pg_catalog.pg_get_function_result(p.oid),
      'kind', p.prokind,
      'security_definer', p.prosecdef,
      'volatility', p.provolatile,
      'search_path_and_configuration', p.proconfig,
      'owner', pg_catalog.pg_get_userbyid(p.proowner),
      'effective_execute_anon', pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE'),
      'effective_execute_authenticated', pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE'),
      'public_execute_acl', EXISTS (
        SELECT 1
        FROM pg_catalog.aclexplode(
          coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
        ) a
        WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'
      ),
      'definition', CASE
        WHEN p.prokind = 'a' THEN NULL
        ELSE pg_catalog.pg_get_functiondef(p.oid)
      END
    ) AS details
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
),
table_acl_rows AS (
  SELECT
    'TABLE_ACL_EFFECTIVE'::text AS section,
    r.schema_name || '.' || r.relation_name AS object_name,
    jsonb_build_object(
      'select_anon', pg_catalog.has_table_privilege('anon', r.oid, 'SELECT'),
      'insert_anon', pg_catalog.has_table_privilege('anon', r.oid, 'INSERT'),
      'update_anon', pg_catalog.has_table_privilege('anon', r.oid, 'UPDATE'),
      'delete_anon', pg_catalog.has_table_privilege('anon', r.oid, 'DELETE'),
      'select_authenticated', pg_catalog.has_table_privilege('authenticated', r.oid, 'SELECT'),
      'insert_authenticated', pg_catalog.has_table_privilege('authenticated', r.oid, 'INSERT'),
      'update_authenticated', pg_catalog.has_table_privilege('authenticated', r.oid, 'UPDATE'),
      'delete_authenticated', pg_catalog.has_table_privilege('authenticated', r.oid, 'DELETE')
    ) AS details
  FROM target_relations r
)
SELECT section, object_name, details
FROM (
  SELECT * FROM policy_rows
  UNION ALL SELECT * FROM policy_summary
  UNION ALL SELECT * FROM trigger_rows
  UNION ALL SELECT * FROM function_rows
  UNION ALL SELECT * FROM table_acl_rows
) audit
ORDER BY section, object_name, details::text;
