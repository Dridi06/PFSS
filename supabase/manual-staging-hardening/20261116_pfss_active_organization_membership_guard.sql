-- MANUAL STAGING HARDENING ONLY.
-- Do not place this file in supabase/migrations or apply it to production.
-- Shared staging previously allowed role-management RPCs to rely on active
-- membership without checking that the owning organization was still active.
-- These replacements fail closed for unauthenticated callers and suspended
-- or archived organizations. Existing role and owner protections are kept.

CREATE OR REPLACE FUNCTION public.pfss_org_remove_member(
  p_membership_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_org uuid;
  v_role text;
  v_actor_role text;
BEGIN
  IF auth.uid() IS NULL OR p_membership_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING errcode = '42501';
  END IF;

  SELECT m.organization_id, m.role
    INTO v_org, v_role
  FROM public.pfss_memberships m
  WHERE m.id = p_membership_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membership not found' USING errcode = 'P0002';
  END IF;

  SELECT actor.role
    INTO v_actor_role
  FROM public.pfss_memberships actor
  JOIN public.pfss_organizations org
    ON org.id = actor.organization_id
  WHERE actor.organization_id = v_org
    AND actor.user_id = auth.uid()
    AND actor.status = 'active'
    AND org.status = 'active';

  IF v_actor_role IS NULL OR v_actor_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Not authorized' USING errcode = '42501';
  END IF;

  IF v_role = 'owner' THEN
    RAISE EXCEPTION 'Owner membership cannot be removed';
  END IF;

  IF v_actor_role = 'admin' AND v_role = 'admin' THEN
    RAISE EXCEPTION 'Only the owner may remove an administrator'
      USING errcode = '42501';
  END IF;

  UPDATE public.pfss_memberships
  SET status = 'removed',
      updated_at = pg_catalog.now()
  WHERE id = p_membership_id;

  INSERT INTO public.pfss_audit_log(
    organization_id, actor_id, action, entity_type, entity_id
  )
  VALUES (
    v_org, auth.uid(), 'membership.removed', 'membership',
    p_membership_id::text
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.pfss_org_update_member(
  p_membership_id uuid,
  p_role text,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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
     OR p_role NOT IN ('admin', 'scout', 'coach', 'analyst', 'finance', 'viewer')
     OR p_status IS NULL
     OR p_status NOT IN ('active', 'suspended') THEN
    RAISE EXCEPTION 'Invalid role or status' USING errcode = '22023';
  END IF;

  SELECT m.organization_id, m.role
    INTO v_org, v_old_role
  FROM public.pfss_memberships m
  WHERE m.id = p_membership_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membership not found' USING errcode = 'P0002';
  END IF;

  SELECT actor.role
    INTO v_actor_role
  FROM public.pfss_memberships actor
  JOIN public.pfss_organizations org
    ON org.id = actor.organization_id
  WHERE actor.organization_id = v_org
    AND actor.user_id = auth.uid()
    AND actor.status = 'active'
    AND org.status = 'active';

  IF v_actor_role IS NULL OR v_actor_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Not authorized' USING errcode = '42501';
  END IF;

  IF v_old_role = 'owner' THEN
    RAISE EXCEPTION 'Owner membership is protected';
  END IF;

  IF v_actor_role = 'admin'
     AND (v_old_role = 'admin' OR p_role = 'admin') THEN
    RAISE EXCEPTION 'Only the owner may manage administrator roles'
      USING errcode = '42501';
  END IF;

  UPDATE public.pfss_memberships
  SET role = p_role,
      status = p_status,
      updated_at = pg_catalog.now()
  WHERE id = p_membership_id;

  INSERT INTO public.pfss_audit_log(
    organization_id, actor_id, action, entity_type, entity_id, metadata
  )
  VALUES (
    v_org, auth.uid(), 'membership.updated', 'membership',
    p_membership_id::text,
    pg_catalog.jsonb_build_object('role', p_role, 'status', p_status)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.pfss_org_remove_member(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pfss_org_remove_member(uuid)
  TO authenticated;

REVOKE ALL ON FUNCTION public.pfss_org_update_member(uuid, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pfss_org_update_member(uuid, text, text)
  TO authenticated;

COMMENT ON FUNCTION public.pfss_org_remove_member(uuid) IS
  'Organization membership removal requires an active owner/admin in an active organization; owner and admin hierarchy protections retained. SECURITY DEFINER with empty search_path.';

COMMENT ON FUNCTION public.pfss_org_update_member(uuid, text, text) IS
  'Organization membership updates require an active owner/admin in an active organization; owner and admin hierarchy protections retained. SECURITY DEFINER with empty search_path.';
