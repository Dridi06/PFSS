-- MANUAL STAGING HARDENING ONLY.
-- Do not place this file in supabase/migrations or apply it to production.
-- The sign-up trigger creates initial PFMS memberships before manual profile
-- approval. Browser-facing authorization helpers therefore require both an
-- approved profile and active membership/organization. Membership-management
-- RPCs and legacy organization creation enforce the same gate.

CREATE OR REPLACE FUNCTION public.pfms_is_org_member(p_org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
  SELECT auth.uid() IS NOT NULL
    AND p_org_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.pfms_memberships m
      JOIN public.pfms_organizations o ON o.id = m.organization_id
      JOIN public.profiles profile ON profile.id = m.user_id
      WHERE m.organization_id = p_org_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
        AND o.status = 'active'
        AND profile.status = 'approved'
    );
$function$;

CREATE OR REPLACE FUNCTION public.pfss_has_org_role(
  p_organization_id uuid,
  p_allowed_roles text[] DEFAULT NULL
)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
  SELECT auth.uid() IS NOT NULL
    AND p_organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.pfss_memberships m
      JOIN public.pfss_organizations o ON o.id = m.organization_id
      JOIN public.profiles profile ON profile.id = m.user_id
      WHERE m.organization_id = p_organization_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
        AND o.status = 'active'
        AND profile.status = 'approved'
        AND (p_allowed_roles IS NULL OR m.role = ANY(p_allowed_roles))
    );
$function$;

CREATE OR REPLACE FUNCTION public.pfss_create_organization(
  p_name text, p_organization_type text, p_slug text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_organization_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING errcode = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles profile
    WHERE profile.id = v_user_id AND profile.status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Profile approval required' USING errcode = '42501';
  END IF;

  IF p_name IS NULL
     OR pg_catalog.length(pg_catalog.btrim(p_name)) < 2
     OR pg_catalog.length(pg_catalog.btrim(p_name)) > 160 THEN
    RAISE EXCEPTION 'Invalid organization name' USING errcode = '22023';
  END IF;

  IF p_organization_type IS NULL
     OR p_organization_type NOT IN ('club','agency','academy','scouting_network','other') THEN
    RAISE EXCEPTION 'Invalid organization type' USING errcode = '22023';
  END IF;

  INSERT INTO public.pfss_organizations(name,organization_type,slug,created_by)
  VALUES (
    pg_catalog.btrim(p_name), p_organization_type,
    pg_catalog.nullif(pg_catalog.lower(pg_catalog.btrim(p_slug)), ''),
    v_user_id
  )
  RETURNING id INTO v_organization_id;

  INSERT INTO public.pfss_memberships(organization_id,user_id,role,status)
  VALUES (v_organization_id,v_user_id,'owner','active');

  RETURN v_organization_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.pfss_org_remove_member(p_membership_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_org uuid;
  v_role text;
  v_actor_role text;
BEGIN
  IF auth.uid() IS NULL OR p_membership_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING errcode = '42501';
  END IF;

  SELECT m.organization_id,m.role INTO v_org,v_role
  FROM public.pfss_memberships m
  WHERE m.id=p_membership_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membership not found' USING errcode = 'P0002';
  END IF;

  SELECT actor.role INTO v_actor_role
  FROM public.pfss_memberships actor
  JOIN public.pfss_organizations org ON org.id=actor.organization_id
  JOIN public.profiles actor_profile ON actor_profile.id=actor.user_id
  WHERE actor.organization_id=v_org
    AND actor.user_id=auth.uid()
    AND actor.status='active'
    AND org.status='active'
    AND actor_profile.status='approved';

  IF v_actor_role IS NULL OR v_actor_role NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'Not authorized' USING errcode = '42501';
  END IF;

  IF v_role='owner' THEN
    RAISE EXCEPTION 'Owner membership cannot be removed';
  END IF;

  IF v_actor_role='admin' AND v_role='admin' THEN
    RAISE EXCEPTION 'Only the owner may remove an administrator' USING errcode='42501';
  END IF;

  UPDATE public.pfss_memberships
  SET status='removed',updated_at=pg_catalog.now()
  WHERE id=p_membership_id;

  INSERT INTO public.pfss_audit_log(organization_id,actor_id,action,entity_type,entity_id)
  VALUES (v_org,auth.uid(),'membership.removed','membership',p_membership_id::text);
END;
$function$;

CREATE OR REPLACE FUNCTION public.pfss_org_update_member(
  p_membership_id uuid,p_role text,p_status text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_org uuid;
  v_old_role text;
  v_actor_role text;
BEGIN
  IF auth.uid() IS NULL OR p_membership_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING errcode = '42501';
  END IF;

  IF p_role IS NULL
     OR p_role NOT IN ('admin','scout','coach','analyst','finance','viewer')
     OR p_status IS NULL
     OR p_status NOT IN ('active','suspended') THEN
    RAISE EXCEPTION 'Invalid role or status' USING errcode = '22023';
  END IF;

  SELECT m.organization_id,m.role INTO v_org,v_old_role
  FROM public.pfss_memberships m
  WHERE m.id=p_membership_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membership not found' USING errcode = 'P0002';
  END IF;

  SELECT actor.role INTO v_actor_role
  FROM public.pfss_memberships actor
  JOIN public.pfss_organizations org ON org.id=actor.organization_id
  JOIN public.profiles actor_profile ON actor_profile.id=actor.user_id
  WHERE actor.organization_id=v_org
    AND actor.user_id=auth.uid()
    AND actor.status='active'
    AND org.status='active'
    AND actor_profile.status='approved';

  IF v_actor_role IS NULL OR v_actor_role NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'Not authorized' USING errcode = '42501';
  END IF;

  IF v_old_role='owner' THEN
    RAISE EXCEPTION 'Owner membership is protected';
  END IF;

  IF v_actor_role='admin' AND (v_old_role='admin' OR p_role='admin') THEN
    RAISE EXCEPTION 'Only the owner may manage administrator roles' USING errcode='42501';
  END IF;

  UPDATE public.pfss_memberships
  SET role=p_role,status=p_status,updated_at=pg_catalog.now()
  WHERE id=p_membership_id;

  INSERT INTO public.pfss_audit_log(organization_id,actor_id,action,entity_type,entity_id,metadata)
  VALUES (v_org,auth.uid(),'membership.updated','membership',p_membership_id::text,
          pg_catalog.jsonb_build_object('role',p_role,'status',p_status));
END;
$function$;

REVOKE ALL ON FUNCTION public.pfms_is_org_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pfms_is_org_member(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.pfss_has_org_role(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pfss_has_org_role(uuid, text[]) TO authenticated;
REVOKE ALL ON FUNCTION public.pfss_create_organization(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pfss_create_organization(text, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.pfss_org_remove_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pfss_org_remove_member(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.pfss_org_update_member(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pfss_org_update_member(uuid, text, text) TO authenticated;

COMMENT ON FUNCTION public.pfms_is_org_member(uuid) IS
  'PFMS membership requires an active membership, active organization and approved profile; SECURITY DEFINER with empty search_path.';
COMMENT ON FUNCTION public.pfss_has_org_role(uuid, text[]) IS
  'PFSS roles require an active membership, active organization and approved profile; SECURITY DEFINER with empty search_path.';
COMMENT ON FUNCTION public.pfss_create_organization(text, text, text) IS
  'Organization self-service creation is restricted to approved profiles; SECURITY DEFINER with empty search_path.';
