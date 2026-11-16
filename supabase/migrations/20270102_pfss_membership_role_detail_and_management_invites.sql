-- Add precise PFSS membership roles and safe organization invitation management.
-- This is additive: existing role values and invitation tokens remain valid.

ALTER TABLE public.pfss_memberships
  ADD COLUMN IF NOT EXISTS role_detail text;

ALTER TABLE public.pfss_invitations
  ADD COLUMN IF NOT EXISTS role_detail text;

DO $$
BEGIN
  ALTER TABLE public.pfss_memberships
    ADD CONSTRAINT pfss_memberships_role_detail_check
    CHECK (
      role_detail IS NULL OR role_detail IN (
        'scout','trainer','co_trainer','betreuer','spieler','analyst','finance','admin'
      )
    );
EXCEPTION WHEN duplicate_object THEN
  NULL;
END;
$$;

DO $$
BEGIN
  ALTER TABLE public.pfss_invitations
    ADD CONSTRAINT pfss_invitations_role_detail_check
    CHECK (
      role_detail IS NULL OR role_detail IN (
        'scout','trainer','co_trainer','betreuer','spieler','analyst','finance','admin'
      )
    );
EXCEPTION WHEN duplicate_object THEN
  NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.pfss_org_create_invitation(
  p_organization_id uuid,
  p_email text,
  p_role_detail text,
  p_expires_in_days integer DEFAULT 7
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_role text;
  v_email text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_email, '')));
  v_role_detail text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_role_detail, '')));
  v_role text;
  v_token text;
  v_token_hash text;
BEGIN
  IF auth.uid() IS NULL OR p_organization_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING errcode = '42501';
  END IF;

  IF v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
     OR pg_catalog.length(v_email) > 254 THEN
    RAISE EXCEPTION 'A valid invitation email is required' USING errcode = '22023';
  END IF;

  IF v_role_detail NOT IN ('scout','trainer','co_trainer','betreuer','spieler') THEN
    RAISE EXCEPTION 'Invalid PFMS invitation role' USING errcode = '22023';
  END IF;

  IF p_expires_in_days IS NULL OR p_expires_in_days NOT BETWEEN 1 AND 30 THEN
    RAISE EXCEPTION 'Invitation expiry must be between 1 and 30 days' USING errcode = '22023';
  END IF;

  SELECT m.role INTO v_actor_role
  FROM public.pfss_memberships AS m
  JOIN public.pfss_organizations AS o ON o.id = m.organization_id
  JOIN public.profiles AS p ON p.id = m.user_id
  WHERE m.organization_id = p_organization_id
    AND m.user_id = auth.uid()
    AND m.status = 'active'
    AND o.status = 'active'
    AND p.status = 'approved'
  FOR UPDATE OF m;

  IF v_actor_role IS NULL OR v_actor_role NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'Not authorized to create organization invitations' USING errcode = '42501';
  END IF;

  v_role := CASE
    WHEN v_role_detail = 'scout' THEN 'scout'
    WHEN v_role_detail IN ('trainer','co_trainer') THEN 'coach'
    WHEN v_role_detail IN ('betreuer','spieler') THEN 'viewer'
    ELSE NULL
  END;

  IF EXISTS (
    SELECT 1
    FROM public.pfss_invitations AS i
    WHERE i.organization_id = p_organization_id
      AND i.email_normalized = v_email
      AND i.accepted_at IS NULL
      AND i.revoked_at IS NULL
      AND i.expires_at > pg_catalog.now()
  ) THEN
    RAISE EXCEPTION 'An active invitation already exists for this email' USING errcode = '23505';
  END IF;

  v_token := pg_catalog.encode(extensions.gen_random_bytes(16), 'hex');
  v_token_hash := pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(v_token, 'UTF8'), 'sha256'),
    'hex'
  );

  INSERT INTO public.pfss_invitations (
    organization_id, email_normalized, role, role_detail,
    token_hash, expires_at, created_by
  )
  VALUES (
    p_organization_id, v_email, v_role, v_role_detail,
    v_token_hash, pg_catalog.now() + pg_catalog.make_interval(days => p_expires_in_days),
    auth.uid()
  );

  INSERT INTO public.pfss_audit_log (
    organization_id, actor_id, action, entity_type, entity_id, metadata
  )
  VALUES (
    p_organization_id, auth.uid(), 'invitation.created', 'invitation',
    v_token_hash,
    pg_catalog.jsonb_build_object('email', v_email, 'role', v_role_detail, 'expires_in_days', p_expires_in_days)
  );

  RETURN v_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.pfss_apply_signup_invitation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'pg_catalog', 'public', 'extensions'
AS $$
DECLARE
  v_code text;
  v_hash text;
  v_inv public.pfss_invitations%ROWTYPE;
  v_role_detail text;
BEGIN
  IF pg_catalog.lower(coalesce(NEW.raw_user_meta_data ->> 'registration_type', '')) <> 'user' THEN
    RETURN NEW;
  END IF;

  v_code := pg_catalog.upper(
    pg_catalog.regexp_replace(
      coalesce(NEW.raw_user_meta_data ->> 'invitation_code', ''),
      '[^A-Fa-f0-9]', '', 'g'
    )
  );

  IF v_code = '' THEN
    RAISE EXCEPTION 'A valid organization invitation is required';
  END IF;

  v_hash := pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(v_code, 'UTF8'), 'sha256'),
    'hex'
  );

  SELECT i.*
  INTO v_inv
  FROM public.pfss_invitations AS i
  WHERE i.token_hash = v_hash
    AND i.accepted_at IS NULL
    AND i.revoked_at IS NULL
    AND i.expires_at > pg_catalog.now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation is invalid, expired, or already used';
  END IF;

  IF v_inv.email_normalized <> pg_catalog.lower(pg_catalog.btrim(coalesce(NEW.email, ''))) THEN
    RAISE EXCEPTION 'Invitation email does not match the registered email';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.pfss_memberships
    WHERE organization_id = v_inv.organization_id AND user_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'Membership already exists';
  END IF;

  v_role_detail := coalesce(
    nullif(v_inv.role_detail, ''),
    CASE v_inv.role
      WHEN 'scout' THEN 'scout'
      WHEN 'coach' THEN 'trainer'
      WHEN 'viewer' THEN 'spieler'
      ELSE v_inv.role
    END
  );

  INSERT INTO public.pfss_memberships (
    organization_id, user_id, role, role_detail, status
  )
  VALUES (
    v_inv.organization_id, NEW.id, v_inv.role, v_role_detail, 'active'
  );

  UPDATE public.pfss_invitations
  SET accepted_at = pg_catalog.now()
  WHERE id = v_inv.id;

  UPDATE public.profiles
  SET role = CASE WHEN v_role_detail = 'scout' THEN 'scout' ELSE 'user' END,
      status = 'approved',
      updated_at = pg_catalog.now()
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.pfss_org_list_members_v2(p_organization_id uuid)
RETURNS TABLE (
  membership_id uuid,
  user_id uuid,
  username text,
  display_name text,
  email text,
  member_role text,
  role_detail text,
  member_status text,
  joined_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.pfss_has_org_role(p_organization_id, ARRAY['owner','admin']) THEN
    RAISE EXCEPTION 'Not authorized' USING errcode = '42501';
  END IF;

  RETURN QUERY
  SELECT m.id, m.user_id, p.username, p.display_name, u.email,
         m.role, m.role_detail, m.status, m.created_at
  FROM public.pfss_memberships AS m
  LEFT JOIN public.profiles AS p ON p.id = m.user_id
  LEFT JOIN auth.users AS u ON u.id = m.user_id
  WHERE m.organization_id = p_organization_id
    AND m.status <> 'removed'
  ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
           pg_catalog.lower(coalesce(p.display_name, p.username, u.email, ''));
END;
$$;

CREATE OR REPLACE FUNCTION public.pfss_org_list_invitations_v2(p_organization_id uuid)
RETURNS TABLE (
  invitation_id uuid,
  email text,
  invite_role text,
  role_detail text,
  expires_at timestamptz,
  created_at timestamptz,
  revoked boolean,
  accepted boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.pfss_has_org_role(p_organization_id, ARRAY['owner','admin']) THEN
    RAISE EXCEPTION 'Not authorized' USING errcode = '42501';
  END IF;

  RETURN QUERY
  SELECT i.id, i.email_normalized, i.role, i.role_detail, i.expires_at,
         i.created_at, i.revoked_at IS NOT NULL, i.accepted_at IS NOT NULL
  FROM public.pfss_invitations AS i
  WHERE i.organization_id = p_organization_id
  ORDER BY i.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.pfss_org_update_member_role_detail(
  p_membership_id uuid,
  p_role text,
  p_role_detail text,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org uuid;
  v_old_role text;
  v_actor_role text;
  v_detail text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_role_detail, '')));
BEGIN
  IF auth.uid() IS NULL OR p_membership_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING errcode = '42501';
  END IF;

  IF p_role IS NULL OR p_role NOT IN ('scout','coach','viewer','analyst','finance','admin')
     OR p_status IS NULL OR p_status NOT IN ('active','suspended')
     OR v_detail NOT IN ('scout','trainer','co_trainer','betreuer','spieler','analyst','finance','admin') THEN
    RAISE EXCEPTION 'Invalid role, detail or status' USING errcode = '22023';
  END IF;

  IF (v_detail = 'scout' AND p_role <> 'scout')
     OR (v_detail IN ('trainer','co_trainer') AND p_role <> 'coach')
     OR (v_detail IN ('betreuer','spieler') AND p_role <> 'viewer')
     OR (v_detail = 'analyst' AND p_role <> 'analyst')
     OR (v_detail = 'finance' AND p_role <> 'finance')
     OR (v_detail = 'admin' AND p_role <> 'admin') THEN
    RAISE EXCEPTION 'Role and role detail are inconsistent' USING errcode = '22023';
  END IF;

  SELECT m.organization_id, m.role
  INTO v_org, v_old_role
  FROM public.pfss_memberships AS m
  WHERE m.id = p_membership_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membership not found' USING errcode = 'P0002';
  END IF;

  SELECT actor.role
  INTO v_actor_role
  FROM public.pfss_memberships AS actor
  JOIN public.pfss_organizations AS org ON org.id = actor.organization_id
  JOIN public.profiles AS profile ON profile.id = actor.user_id
  WHERE actor.organization_id = v_org
    AND actor.user_id = auth.uid()
    AND actor.status = 'active'
    AND org.status = 'active'
    AND profile.status = 'approved';

  IF v_actor_role IS NULL OR v_actor_role NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'Not authorized' USING errcode = '42501';
  END IF;

  IF v_old_role = 'owner' THEN
    RAISE EXCEPTION 'Owner membership is protected' USING errcode = '42501';
  END IF;

  IF v_actor_role = 'admin' AND (v_old_role = 'admin' OR p_role = 'admin') THEN
    RAISE EXCEPTION 'Only the owner may manage administrator roles' USING errcode = '42501';
  END IF;

  UPDATE public.pfss_memberships
  SET role = p_role, role_detail = v_detail, status = p_status, updated_at = pg_catalog.now()
  WHERE id = p_membership_id;

  INSERT INTO public.pfss_audit_log (
    organization_id, actor_id, action, entity_type, entity_id, metadata
  )
  VALUES (
    v_org, auth.uid(), 'membership.updated', 'membership', p_membership_id::text,
    pg_catalog.jsonb_build_object('role', p_role, 'role_detail', v_detail, 'status', p_status)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pfss_apply_signup_invitation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pfss_org_create_invitation(uuid,text,text,integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pfss_org_list_members_v2(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pfss_org_list_invitations_v2(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pfss_org_update_member_role_detail(uuid,text,text,text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.pfss_org_create_invitation(uuid,text,text,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pfss_org_list_members_v2(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pfss_org_list_invitations_v2(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pfss_org_update_member_role_detail(uuid,text,text,text) TO authenticated;

-- Rebuild the unified role reader so invitations, memberships and profile routing
-- use the same active PFSS organization records as the registration trigger.
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
  v_pfss_organizations jsonb := '[]'::jsonb;
  v_team_assignments jsonb := '[]'::jsonb;
  v_roles jsonb := '[]'::jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING errcode = '42501';
  END IF;

  SELECT pg_catalog.lower(pg_catalog.btrim(coalesce(p.role, '')))
    INTO v_profile_role
  FROM public.profiles AS p
  WHERE p.id = v_user_id AND p.status = 'approved';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Approved profile required' USING errcode = '42501';
  END IF;

  v_is_platform_admin := v_profile_role IN ('admin','administrator');

  IF to_regclass('public.pfss_platform_roles') IS NOT NULL THEN
    EXECUTE $sql$
      SELECT EXISTS (
        SELECT 1 FROM public.pfss_platform_roles AS r
        JOIN public.profiles AS p ON p.id = r.user_id
        WHERE r.user_id = $1 AND r.role = 'platform_admin' AND p.status = 'approved'
      )
    $sql$
    INTO v_is_platform_admin USING v_user_id;
    v_is_platform_admin := v_is_platform_admin OR v_profile_role IN ('admin','administrator');
  END IF;

  SELECT pg_catalog.lower(pg_catalog.btrim(coalesce(s.scout_type, '')))
    INTO v_scout_type
  FROM public.pfms_scout_profiles AS s
  WHERE s.user_id = v_user_id AND s.status = 'active'
  ORDER BY s.created_at DESC LIMIT 1;

  SELECT coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'organization_id', x.organization_id,
        'organization_name', x.organization_name,
        'organization_type', x.organization_type,
        'organization_status', x.organization_status,
        'member_role', x.member_role,
        'source_member_role', x.source_member_role,
        'role_detail', x.role_detail,
        'membership_status', x.membership_status,
        'can_manage_organization', x.can_manage_organization,
        'source_model', x.source_model
      )
      ORDER BY x.organization_name, x.organization_id, x.source_model
    ),
    '[]'::jsonb
  )
  INTO v_organizations
  FROM (
    SELECT
      o.id AS organization_id, o.name AS organization_name, o.organization_type,
      o.status AS organization_status,
      CASE
        WHEN m.member_role = 'owner' THEN 'owner'
        WHEN m.member_role IN ('admin','manager') AND o.organization_type = 'club' THEN 'club_admin'
        WHEN m.member_role IN ('admin','manager') AND o.organization_type = 'agency' THEN 'agency_admin'
        ELSE m.member_role
      END AS member_role,
      m.member_role AS source_member_role,
      NULL::text AS role_detail,
      m.status AS membership_status,
      (m.member_role = 'owner' OR
        (m.member_role IN ('admin','manager')
          AND CASE
            WHEN pg_catalog.jsonb_typeof(m.permissions->'manage_members')='boolean'
              THEN (m.permissions->>'manage_members')::boolean
            ELSE false
          END)
      ) AS can_manage_organization,
      'pfms'::text AS source_model
    FROM public.pfms_memberships AS m
    JOIN public.pfms_organizations AS o ON o.id=m.organization_id
    WHERE m.user_id=v_user_id AND m.status='active' AND o.status='active'

    UNION ALL

    SELECT
      o.id, o.name,
      CASE WHEN o.organization_type='academy' THEN 'club'
           WHEN o.organization_type='scouting_network' THEN 'agency'
           ELSE o.organization_type END,
      o.status,
      CASE
        WHEN m.role='owner' THEN 'owner'
        WHEN m.role='admin' AND o.organization_type IN ('club','academy') THEN 'club_admin'
        WHEN m.role='admin' AND o.organization_type IN ('agency','scouting_network') THEN 'agency_admin'
        WHEN m.role='coach' THEN coalesce(nullif(m.role_detail,''),'trainer')
        WHEN m.role='viewer' THEN coalesce(nullif(m.role_detail,''),'spieler')
        ELSE m.role
      END,
      m.role,
      m.role_detail,
      m.status,
      m.role IN ('owner','admin'),
      'pfss'
    FROM public.pfss_memberships AS m
    JOIN public.pfss_organizations AS o ON o.id=m.organization_id
    JOIN public.profiles AS p ON p.id=m.user_id
    WHERE m.user_id=v_user_id AND m.status='active' AND o.status='active' AND p.status='approved'

  ) AS x;

  IF to_regclass('public.pfms_legacy_teams') IS NOT NULL
     AND to_regclass('public.pfms_legacy_team_staff') IS NOT NULL
     AND to_regclass('public.organizations') IS NOT NULL
     AND to_regclass('public.organization_memberships') IS NOT NULL THEN
    EXECUTE $sql$
      SELECT coalesce(
        pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'team_id',t.id,'team_name',t.team_name,'team_status',t.status,
          'organization_id',t.organization_id,'organization_name',o.name,
          'organization_type',o.organization_type,'team_role',s.role,
          'assignment_status',s.status
        ) ORDER BY o.name,t.team_name,t.id),'[]'::jsonb)
      FROM public.pfms_legacy_team_staff s
      JOIN public.pfms_legacy_teams t ON t.id=s.team_id
      JOIN public.organizations o ON o.id=t.organization_id
      JOIN public.organization_memberships active_m
        ON active_m.organization_id=t.organization_id AND active_m.user_id=$1 AND active_m.status='active'
      WHERE s.user_id=$1 AND s.status='active' AND t.status='active'
        AND o.status IN ('approved','active')
        AND s.role IN ('trainer','co_trainer','betreuer')
    $sql$
    INTO v_team_assignments USING v_user_id;
  END IF;

  SELECT coalesce(pg_catalog.jsonb_agg(r.role_value ORDER BY r.role_value),'[]'::jsonb)
  INTO v_roles
  FROM (
    SELECT DISTINCT CASE
      WHEN o.value->>'organization_type'='club' AND o.value->>'member_role' IN ('owner','club_admin') THEN 'verein'
      WHEN o.value->>'organization_type'='agency' AND o.value->>'member_role' IN ('owner','agency_admin') THEN 'agentur'
      WHEN o.value->>'organization_type'='club' AND o.value->>'member_role'='scout' THEN 'scout'
      WHEN o.value->>'organization_type'='agency' AND o.value->>'member_role'='scout' THEN 'agenturscout'
      WHEN o.value->>'member_role' IN ('trainer','coach') THEN 'trainer'
      WHEN o.value->>'member_role' IN ('co_trainer','cotrainer') THEN 'co_trainer'
      WHEN o.value->>'member_role'='betreuer' THEN 'betreuer'
      WHEN o.value->>'member_role' IN ('spieler','player','member') THEN 'spieler'
      ELSE NULL
    END AS role_value
    FROM pg_catalog.jsonb_array_elements(v_organizations) o(value)

    UNION ALL
    SELECT CASE
      WHEN v_profile_role IN ('admin','administrator') THEN 'admin'
      WHEN v_profile_role='scout' THEN 'scout'
      WHEN v_profile_role IN ('spieler','player') THEN 'spieler'
      WHEN v_profile_role='trainer' THEN 'trainer'
      WHEN v_profile_role IN ('co_trainer','cotrainer') THEN 'co_trainer'
      WHEN v_profile_role='betreuer' THEN 'betreuer'
      WHEN v_scout_type='agency_scout' THEN 'agenturscout'
      WHEN v_scout_type IN ('solo_scout','club_scout') THEN 'scout'
      ELSE NULL
    END

    UNION ALL
    SELECT t.value->>'team_role'
    FROM pg_catalog.jsonb_array_elements(v_team_assignments) t(value)

    UNION ALL
    SELECT 'admin' WHERE v_is_platform_admin
  ) r
  WHERE r.role_value IS NOT NULL;

  RETURN pg_catalog.jsonb_build_object(
    'profile_role',v_profile_role,'is_platform_admin',v_is_platform_admin,
    'roles',v_roles,'scout_type',v_scout_type,
    'organizations',v_organizations,'team_assignments',v_team_assignments
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pfss_org_create_invitation(uuid,text,text,integer) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.pfss_org_list_members_v2(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.pfss_org_list_invitations_v2(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.pfss_org_update_member_role_detail(uuid,text,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.pfms_get_my_role_context() FROM PUBLIC,anon;

GRANT EXECUTE ON FUNCTION public.pfss_org_create_invitation(uuid,text,text,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pfss_org_list_members_v2(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pfss_org_list_invitations_v2(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pfss_org_update_member_role_detail(uuid,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pfms_get_my_role_context() TO authenticated;
