-- PFSS: Administratoren duerfen ebenfalls Einladungen fuer Organisationen erstellen.
-- Organisationsverwalter behalten ihre bisherige Berechtigung.

CREATE OR REPLACE FUNCTION public.pfms_create_legacy_invitation(
  p_organization_id uuid,
  p_role text DEFAULT 'scout',
  p_expires_in_days integer DEFAULT 7
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_code text;
  v_org_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING errcode = '42501';
  END IF;

  IF p_role NOT IN ('scout','trainer','co_trainer','betreuer','member') THEN
    RAISE EXCEPTION 'Role cannot be assigned by invitation';
  END IF;

  IF p_expires_in_days IS NULL OR p_expires_in_days < 1 OR p_expires_in_days > 30 THEN
    RAISE EXCEPTION 'Invitation validity must be between 1 and 30 days';
  END IF;

  IF NOT (public.is_admin() OR public.can_manage_org(p_organization_id)) THEN
    RAISE EXCEPTION 'Not authorized to invite members' USING errcode = '42501';
  END IF;

  SELECT o.status INTO v_org_status
  FROM public.organizations AS o
  WHERE o.id = p_organization_id
  FOR SHARE;

  IF NOT FOUND OR v_org_status <> 'approved' THEN
    RAISE EXCEPTION 'Organization is not approved';
  END IF;

  v_code := pg_catalog.upper(pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''));

  INSERT INTO public.organization_invitations (
    code_hash, organization_id, role, created_by, expires_at
  )
  VALUES (
    pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to(v_code, 'UTF8')),
      'hex'
    ),
    p_organization_id,
    p_role,
    auth.uid(),
    pg_catalog.now() + pg_catalog.make_interval(days => p_expires_in_days)
  );

  RETURN v_code;
END;
$$;

REVOKE ALL ON FUNCTION public.pfms_create_legacy_invitation(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pfms_create_legacy_invitation(uuid, text, integer) TO authenticated;
