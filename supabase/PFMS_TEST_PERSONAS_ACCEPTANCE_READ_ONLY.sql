-- PFMS staging test-persona acceptance audit.
-- Read-only. Run only against the dedicated staging project.
WITH role_counts AS (
  SELECT test_role, count(*)::integer AS actual_count
  FROM public.pfms_test_personas
  GROUP BY test_role
),
expected(test_role, expected_count) AS (
  VALUES
    ('scout', 5), ('verein', 5), ('trainer', 5), ('co_trainer', 5),
    ('agentur', 5), ('agenturscout', 5), ('betreuer', 5),
    ('spieler', 5), ('admin', 1)
),
checks AS (
  SELECT 'all_expected_roles_present'::text AS check_name,
         (SELECT count(*) FROM expected e LEFT JOIN role_counts r USING (test_role)
          WHERE coalesce(r.actual_count, 0) = e.expected_count) = 9 AS passed,
         'Each of the nine roles has its expected fixture count.'::text AS details
  UNION ALL
  SELECT 'total_fixture_count',
         (SELECT count(*) FROM public.pfms_test_personas) = 41,
         'Exactly 41 synthetic personas exist.'
  UNION ALL
  SELECT 'all_fixtures_marked_test',
         (SELECT coalesce(bool_and(is_test), false) FROM public.pfms_test_personas),
         'Every fixture is explicitly marked as test data.'
  UNION ALL
  SELECT 'all_logins_disabled',
         (SELECT coalesce(bool_and(login_enabled = false), false) FROM public.pfms_test_personas),
         'No fixture can be used as a login account.'
  UNION ALL
  SELECT 'no_email_or_auth_identity',
         NOT EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'pfms_test_personas'
             AND column_name IN ('email', 'auth_user_id', 'user_id')
         ),
         'Fixture schema contains no email or Auth identity column.'
  UNION ALL
  SELECT 'rls_enabled_and_forced',
         (SELECT relrowsecurity AND relforcerowsecurity
          FROM pg_class WHERE oid = 'public.pfms_test_personas'::regclass),
         'Row-level security is enabled and forced.'
  UNION ALL
  SELECT 'no_client_role_grants',
         NOT EXISTS (
           SELECT 1 FROM information_schema.role_table_grants
           WHERE table_schema = 'public' AND table_name = 'pfms_test_personas'
             AND grantee IN ('anon', 'authenticated')
         ),
         'anon and authenticated have no direct table privileges.'
  UNION ALL
  SELECT 'real_auth_users_unchanged_baseline',
         (SELECT count(*) FROM auth.users) = 1,
         'Staging baseline expects the pre-existing single Auth user; adjust only after explicit fixture-auth provisioning.'
  UNION ALL
  SELECT 'real_profiles_unchanged_baseline',
         (SELECT count(*) FROM public.profiles) = 1,
         'Staging baseline expects the pre-existing single profile.'
)
SELECT check_name, passed, details
FROM checks
ORDER BY check_name;
