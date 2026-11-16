-- Read-only role context for all active memberships of the authenticated user.
-- The RPC exposes no other user's private membership data and performs no writes.

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
  v_is_platform_admin boolean;
  v_organizations jsonb;
  v_team_assignments jsonb;
  v_roles jsonb;
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

  SELECT coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'organization_id', membership.organization_id,
        'organization_name', membership.organization_name,
        'organization_type', membership.organization_type,
        'organization_status', membership.organization_status,
        'member_role', membership.member_role,
        'membership_status', membership.membership_status
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
      m.role AS member_role,
      m.status AS membership_status
    FROM public.organization_memberships AS m
    JOIN public.organizations AS o ON o.id = m.organization_id
    WHERE m.user_id = v_user_id
      AND m.status = 'active'
      AND o.status IN ('approved', 'active')
  ) AS membership;

  SELECT coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'team_id', assignment.team_id,
        'team_name', assignment.team_name,
        'team_status', assignment.team_status,
        'organization_id', assignment.organization_id,
        'organization_name', assignment.organization_name,
        'organization_type', assignment.organization_type,
        'team_role', assignment.team_role,
        'assignment_status', assignment.assignment_status
      )
      ORDER BY assignment.organization_name, assignment.team_name, assignment.team_id
    ),
    '[]'::jsonb
  )
  INTO v_team_assignments
  FROM (
    SELECT
      t.id AS team_id,
      t.team_name,
      t.status AS team_status,
      t.organization_id,
      o.name AS organization_name,
      o.organization_type,
      s.role AS team_role,
      s.status AS assignment_status
    FROM public.pfms_legacy_team_staff AS s
    JOIN public.pfms_legacy_teams AS t ON t.id = s.team_id
    JOIN public.organizations AS o ON o.id = t.organization_id
    JOIN public.organization_memberships AS active_membership

      ON active_membership.organization_id = t.organization_id

     AND active_membership.user_id = v_user_id

     AND active_membership.status = 'active'
    WHERE s.user_id = v_user_id
      AND s.status = 'active'
      AND t.status = 'active'
      AND o.status IN ('approved', 'active')
      AND s.role IN ('trainer', 'co_trainer', 'betreuer')
  ) AS assignment;

  SELECT coalesce(
    pg_catalog.jsonb_agg(role_row.role_value ORDER BY role_row.role_value),
    '[]'::jsonb
  )
  INTO v_roles
  FROM (
    SELECT DISTINCT all_roles.role_value
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
        WHEN o.organization_type = 'club' AND m.role IN ('owner', 'club_admin') THEN 'verein'
        WHEN o.organization_type = 'agency' AND m.role IN ('owner', 'agency_admin') THEN 'agentur'
        WHEN o.organization_type = 'club' AND m.role = 'scout' THEN 'scout'
        WHEN o.organization_type = 'agency' AND m.role = 'scout' THEN 'agenturscout'
        WHEN m.role IN ('trainer', 'coach') THEN 'trainer'
        WHEN m.role IN ('co_trainer', 'cotrainer') THEN 'co_trainer'
        WHEN m.role = 'betreuer' THEN 'betreuer'
        WHEN m.role = 'member' THEN 'spieler'
        ELSE NULL
      END
      FROM public.organization_memberships AS m
      JOIN public.organizations AS o ON o.id = m.organization_id
      WHERE m.user_id = v_user_id
        AND m.status = 'active'
        AND o.status IN ('approved', 'active')

      UNION ALL

      SELECT s.role
      FROM public.pfms_legacy_team_staff AS s
      JOIN public.pfms_legacy_teams AS t ON t.id = s.team_id
      JOIN public.organizations AS o ON o.id = t.organization_id
      JOIN public.organization_memberships AS active_membership

        ON active_membership.organization_id = t.organization_id

       AND active_membership.user_id = v_user_id

       AND active_membership.status = 'active'
      WHERE s.user_id = v_user_id
        AND s.status = 'active'
        AND t.status = 'active'
        AND o.status IN ('approved', 'active')
        AND s.role IN ('trainer', 'co_trainer', 'betreuer')
    ) AS all_roles
    WHERE all_roles.role_value IS NOT NULL
  ) AS role_row;

  RETURN pg_catalog.jsonb_build_object(
    'profile_role', v_profile_role,
    'is_platform_admin', v_is_platform_admin,
    'roles', v_roles,
    'organizations', v_organizations,
    'team_assignments', v_team_assignments
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pfms_get_my_role_context() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pfms_get_my_role_context() TO authenticated;

COMMENT ON FUNCTION public.pfms_get_my_role_context() IS
  'Returns only the authenticated approved user''s own active organisation memberships and team staff assignments. Read-only UI role context; RLS and feature RPCs remain the access-control boundary.';
