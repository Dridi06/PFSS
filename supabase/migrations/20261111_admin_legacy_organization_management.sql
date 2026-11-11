-- PFMS: Admin-Verwaltung auf das bestehende Organisationssystem ausrichten
-- Additive Migration: nutzt organizations und organization_memberships.
-- Bestehende Tabellen, Daten und Policies werden nicht verändert.

CREATE OR REPLACE FUNCTION public.pfms_admin_search_legacy_organizations(
  p_type text DEFAULT NULL,
  p_query text DEFAULT ''
)
RETURNS TABLE (
  id uuid,
  organization_type text,
  name text,
  status text,
  created_at timestamptz,
  member_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized' USING errcode = '42501';
  END IF;

  IF p_type IS NOT NULL
     AND p_type NOT IN ('club', 'agency', 'scout_workspace') THEN
    RAISE EXCEPTION 'Invalid organization type';
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o.organization_type,
    o.name,
    o.status,
    o.created_at,
    COUNT(m.id) FILTER (WHERE m.status = 'active') AS member_count
  FROM public.organizations AS o
  LEFT JOIN public.organization_memberships AS m
    ON m.organization_id = o.id
  WHERE (p_type IS NULL OR o.organization_type = p_type)
    AND (
      COALESCE(pg_catalog.trim(p_query), '') = ''
      OR o.name ILIKE '%' || pg_catalog.trim(p_query) || '%'
      OR o.id::text ILIKE '%' || pg_catalog.trim(p_query) || '%'
    )
  GROUP BY o.id
  ORDER BY o.name;
END;
$$;

CREATE OR REPLACE FUNCTION public.pfms_admin_list_legacy_org_members(
  p_org_id uuid
)
RETURNS TABLE (
  membership_id uuid,
  user_id uuid,
  username text,
  full_name text,
  email text,
  member_role text,
  status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized' USING errcode = '42501';
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.user_id,
    p.username,
    p.full_name,
    u.email,
    m.role,
    m.status
  FROM public.organization_memberships AS m
  LEFT JOIN public.profiles AS p ON p.id = m.user_id
  LEFT JOIN auth.users AS u ON u.id = m.user_id
  WHERE m.organization_id = p_org_id
  ORDER BY
    CASE m.role
      WHEN 'owner' THEN 0
      WHEN 'club_admin' THEN 1
      WHEN 'agency_admin' THEN 1
      ELSE 2
    END,
    pg_catalog.lower(COALESCE(p.username, p.full_name, u.email, ''));
END;
$$;

CREATE OR REPLACE FUNCTION public.pfms_admin_update_legacy_membership(
  p_membership_id uuid,
  p_role text,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org_id uuid;
  v_current_role text;
  v_current_status text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized' USING errcode = '42501';
  END IF;

  IF p_role NOT IN (
    'owner', 'club_admin', 'agency_admin', 'scout',
    'trainer', 'co_trainer', 'betreuer', 'member'
  ) THEN
    RAISE EXCEPTION 'Invalid membership role';
  END IF;

  IF p_status NOT IN ('pending', 'active', 'suspended') THEN
    RAISE EXCEPTION 'Invalid membership status';
  END IF;

  SELECT m.organization_id, m.role, m.status
  INTO v_org_id, v_current_role, v_current_status
  FROM public.organization_memberships AS m
  WHERE m.id = p_membership_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membership not found';
  END IF;

  IF v_current_role = 'owner'
     AND v_current_status = 'active'
     AND (p_role <> 'owner' OR p_status <> 'active')
     AND NOT EXISTS (
       SELECT 1
       FROM public.organization_memberships AS other_owner
       WHERE other_owner.organization_id = v_org_id
         AND other_owner.id <> p_membership_id
         AND other_owner.role = 'owner'
         AND other_owner.status = 'active'
     ) THEN
    RAISE EXCEPTION 'The organization must retain at least one active owner';
  END IF;

  UPDATE public.organization_memberships
  SET role = p_role,
      status = p_status,
      updated_at = pg_catalog.now()
  WHERE id = p_membership_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.pfms_admin_list_legacy_scouts(
  p_query text DEFAULT ''
)
RETURNS TABLE (
  user_id uuid,
  username text,
  full_name text,
  email text,
  profile_status text,
  organization_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized' USING errcode = '42501';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.username,
    p.full_name,
    u.email,
    p.status,
    COUNT(DISTINCT m.organization_id) FILTER (WHERE m.status = 'active')
  FROM public.profiles AS p
  LEFT JOIN auth.users AS u ON u.id = p.id
  LEFT JOIN public.organization_memberships AS m
    ON m.user_id = p.id
   AND m.role = 'scout'
  WHERE (
      pg_catalog.lower(COALESCE(p.role, '')) = 'scout'
      OR m.id IS NOT NULL
    )
    AND (
      COALESCE(pg_catalog.trim(p_query), '') = ''
      OR COALESCE(p.username, '') ILIKE '%' || pg_catalog.trim(p_query) || '%'
      OR COALESCE(p.full_name, '') ILIKE '%' || pg_catalog.trim(p_query) || '%'
      OR COALESCE(u.email, '') ILIKE '%' || pg_catalog.trim(p_query) || '%'
      OR p.id::text ILIKE '%' || pg_catalog.trim(p_query) || '%'
    )
  GROUP BY p.id, p.username, p.full_name, u.email, p.status
  ORDER BY pg_catalog.lower(COALESCE(p.username, p.full_name, u.email, ''));
END;
$$;

REVOKE ALL ON FUNCTION public.pfms_admin_search_legacy_organizations(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pfms_admin_list_legacy_org_members(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pfms_admin_update_legacy_membership(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pfms_admin_list_legacy_scouts(text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.pfms_admin_search_legacy_organizations(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pfms_admin_list_legacy_org_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pfms_admin_update_legacy_membership(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pfms_admin_list_legacy_scouts(text) TO authenticated;
