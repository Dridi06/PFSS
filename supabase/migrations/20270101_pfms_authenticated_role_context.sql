-- Read-only role context for the authenticated PFMS account.
-- Canonical PFMS memberships are authoritative. Legacy team assignments are read
-- only when their legacy tables exist, so a partial staging schema fails closed.

CREATE OR REPLACE FUNCTION public.pfms_get_my_role_context()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile_role text;
  v_is_platform_admin boolean := false;
  v_scout_type text;
  v_organizations jsonb := '[]'::jsonb;
  v_legacy_organizations jsonb := '[]'::jsonb;
  v_team_assignments jsonb := '[]'::jsonb;
  v_roles jsonb := '[]'::jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING errcode = '42501';
  END IF;

  SELECT pg_catalog.lower(pg_catalog.btrim(coalesce(p.role, '')))
    INTO v_profile_role
  FROM public.profiles AS p
  WHERE p.id = v_user_id
    AND p.status = 'approved';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Approved profile required' USING errcode = '42501';
  END IF;

  v_is_platform_admin := v_profile_role IN ('admin', 'administrator');

  IF to_regclass('public.pfss_platform_roles') IS NOT NULL THEN
    EXECUTE $sql$
      SELECT EXISTS (
        SELECT 1
        FROM public.pfss_platform_roles AS r
        JOIN public.profiles AS p ON p.id = r.user_id
        WHERE r.user_id = $1
          AND r.role = 'platform_admin'
          AND p.status = 'approved'
      )
    $sql$
    INTO v_is_platform_admin
    USING v_user_id;
    v_is_platform_admin := v_is_platform_admin OR v_profile_role IN ('admin', 'administrator');
  END IF;

  SELECT pg_catalog.lower(pg_catalog.btrim(coalesce(s.scout_type, '')))
    INTO v_scout_type
  FROM public.pfms_scout_profiles AS s
  WHERE s.user_id = v_user_id
    AND s.status = 'active'
  ORDER BY s.created_at DESC
  LIMIT 1;

  SELECT coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'organization_id', membership.organization_id,
        'organization_name', membership.organization_name,
        'organization_type', membership.organization_type,
        'organization_status', membership.organization_status,
        'member_role', membership.member_role,
        'source_member_role', membership.source_member_role,
        'membership_status', membership.membership_status,
        'can_manage_organization', membership.can_manage_organization,
        'source_model', 'pfms'
      )
      ORDER BY membership.organization_name, membership.organization_id
    ),
    '[]'::jsonb
  )
  INTO v_organizations
  FROM (
    SELECT
      o.id AS organization_id,
      o.name AS organization_name,
      o.organization_type,
      o.status AS organization_status,
      CASE
        WHEN m.member_role = 'owner' THEN 'owner'
        WHEN m.member_role IN ('admin', 'manager')
          AND coalesce((m.permissions ->> 'manage_members')::boolean, false)
          AND o.organization_type = 'club' THEN 'club_admin'
        WHEN m.member_role IN ('admin', 'manager')
          AND coalesce((m.permissions ->> 'manage_members')::boolean, false)
          AND o.organization_type = 'agency' THEN 'agency_admin'
        ELSE m.member_role
      END AS member_role,
      m.member_role AS source_member_role,
      m.status AS membership_status,
      (
        m.member_role = 'owner'
        OR (
          m.member_role IN ('admin', 'manager')
          AND coalesce((m.permissions ->> 'manage_members')::boolean, false)
        )
      ) AS can_manage_organization
    FROM public.pfms_memberships AS m
    JOIN public.pfms_organizations AS o ON o.id = m.organization_id
    WHERE m.user_id = v_user_id
      AND m.status = 'active'
      AND o.status = 'active'
  ) AS membership;

  -- Compatibility with the older organization model used by legacy invitation
  -- and team screens. These tables are optional and never assumed to exist.
  IF to_regclass('public.organizations') IS NOT NULL
     AND to_regclass('public.organization_memberships') IS NOT NULL THEN
    EXECUTE $sql$
      SELECT coalesce(
        pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'organization_id', o.id,
            'organization_name', o.name,
            'organization_type', o.organization_type,
            'organization_status', o.status,
            'member_role', m.role,
            'source_member_role', m.role,
            'membership_status', m.status,
            'can_manage_organization', m.role IN ('owner', 'club_admin', 'agency_admin'),
            'source_model', 'legacy'
          )
          ORDER BY o.name, o.id
        ),
        '[]'::jsonb
      )
      FROM public.organization_memberships AS m
      JOIN public.organizations AS o ON o.id = m.organization_id
      WHERE m.user_id = $1
        AND m.status = 'active'
        AND o.status IN ('approved', 'active')
    $sql$
    INTO v_legacy_organizations
    USING v_user_id;
    v_organizations := v_organizations || coalesce(v_legacy_organizations, '[]'::jsonb);
  END IF;

  IF to_regclass('public.pfms_legacy_teams') IS NOT NULL
     AND to_regclass('public.pfms_legacy_team_staff') IS NOT NULL
     AND to_regclass('public.organizations') IS NOT NULL
     AND to_regclass('public.organization_memberships') IS NOT NULL THEN
    EXECUTE $sql$
      SELECT coalesce(
        pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'team_id', t.id,
            'team_name', t.team_name,
            'team_status', t.status,
            'organization_id', t.organization_id,
            'organization_name', o.name,
            'organization_type', o.organization_type,
            'team_role', s.role,
            'assignment_status', s.status
          )
          ORDER BY o.name, t.team_name, t.id
        ),
        '[]'::jsonb
      )
      FROM public.pfms_legacy_team_staff AS s
      JOIN public.pfms_legacy_teams AS t ON t.id = s.team_id
      JOIN public.organizations AS o ON o.id = t.organization_id
      JOIN public.organization_memberships AS active_membership
        ON active_membership.organization_id = t.organization_id
       AND active_membership.user_id = $1
       AND active_membership.status = 'active'
      WHERE s.user_id = $1
        AND s.status = 'active'
        AND t.status = 'active'
        AND o.status IN ('approved', 'active')
        AND s.role IN ('trainer', 'co_trainer', 'betreuer')
    $sql$
    INTO v_team_assignments
    USING v_user_id;
  END IF;

  SELECT coalesce(
    pg_catalog.jsonb_agg(role_value ORDER BY role_value),
    '[]'::jsonb
  )
  INTO v_roles
  FROM (
    SELECT DISTINCT derived.role_value
    FROM (
      SELECT CASE v_profile_role
        WHEN 'admin' THEN 'admin'
        WHEN 'administrator' THEN 'admin'
        WHEN 'scout' THEN 'scout'
        WHEN 'agenturscout' THEN 'agenturscout'
        WHEN 'trainer' THEN 'trainer'
        WHEN 'coach' THEN 'trainer'
        WHEN 'co_trainer' THEN 'co_trainer'
        WHEN 'cotrainer' THEN 'co_trainer'
        WHEN 'betreuer' THEN 'betreuer'
        WHEN 'spieler' THEN 'spieler'
        WHEN 'player' THEN 'spieler'
        ELSE NULL
      END AS role_value

      UNION ALL

      SELECT CASE
        WHEN organization.value ->> 'organization_type' = 'club'
          AND (organization.value ->> 'member_role') IN ('owner', 'club_admin') THEN 'verein'
        WHEN organization.value ->> 'organization_type' = 'agency'
          AND (organization.value ->> 'member_role') IN ('owner', 'agency_admin') THEN 'agentur'
        WHEN organization.value ->> 'organization_type' = 'club'
          AND (organization.value ->> 'member_role') = 'scout' THEN 'scout'
        WHEN organization.value ->> 'organization_type' = 'agency'
          AND (organization.value ->> 'member_role') = 'scout' THEN 'agenturscout'
        WHEN (organization.value ->> 'member_role') IN ('trainer', 'coach') THEN 'trainer'
        WHEN (organization.value ->> 'member_role') IN ('co_trainer', 'cotrainer') THEN 'co_trainer'
        WHEN (organization.value ->> 'member_role') = 'betreuer' THEN 'betreuer'
        WHEN (organization.value ->> 'member_role') = 'member' THEN 'spieler'
        ELSE NULL
      END
      FROM pg_catalog.jsonb_array_elements(v_organizations) AS organization(value)

      UNION ALL

      SELECT CASE
        WHEN v_scout_type = 'agency_scout' THEN 'agenturscout'
        WHEN v_scout_type IN ('solo_scout', 'club_scout') THEN 'scout'
        ELSE NULL
      END

      UNION ALL

      SELECT assignment.value ->> 'team_role'
      FROM pg_catalog.jsonb_array_elements(v_team_assignments) AS assignment(value)

      UNION ALL

      SELECT 'admin' WHERE v_is_platform_admin
    ) AS derived
    WHERE derived.role_value IS NOT NULL
  ) AS roles;

  RETURN pg_catalog.jsonb_build_object(
    'profile_role', v_profile_role,
    'is_platform_admin', v_is_platform_admin,
    'roles', v_roles,
    'scout_type', v_scout_type,
    'organizations', v_organizations,
    'team_assignments', v_team_assignments
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pfms_get_my_role_context() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pfms_get_my_role_context() TO authenticated;

COMMENT ON FUNCTION public.pfms_get_my_role_context() IS
  'Returns only the authenticated approved user''s own active PFMS memberships, active scout profile and active team assignments. Read-only role context; RLS and feature RPCs remain the access-control boundary.';
