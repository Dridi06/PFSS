-- Complete the organization management actions used by the PFMS frontend.
-- Both operations are scoped to the target organization, require an approved
-- owner/admin membership, preserve owner/admin hierarchy, and write audit events.

CREATE OR REPLACE FUNCTION public.pfss_org_remove_member(p_membership_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org_id uuid;
  v_target_user_id uuid;
  v_target_role text;
  v_actor_role text;
BEGIN
  IF auth.uid() IS NULL OR p_membership_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING errcode = '42501';
  END IF;

  SELECT m.organization_id, m.user_id, m.role
    INTO v_org_id, v_target_user_id, v_target_role
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
  WHERE actor.organization_id = v_org_id
    AND actor.user_id = auth.uid()
    AND actor.status = 'active'
    AND org.status = 'active'
    AND profile.status = 'approved';

  IF v_actor_role IS NULL OR v_actor_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Not authorized' USING errcode = '42501';
  END IF;

  IF v_target_role = 'owner' THEN
    RAISE EXCEPTION 'Owner membership is protected' USING errcode = '42501';
  END IF;

  IF v_actor_role = 'admin' AND v_target_role = 'admin' THEN
    RAISE EXCEPTION 'Only the owner may remove an administrator' USING errcode = '42501';
  END IF;

  IF v_target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Self-removal is not permitted; transfer ownership or contact another owner' USING errcode = '42501';
  END IF;

  UPDATE public.pfss_memberships
  SET status = 'removed',
      updated_at = pg_catalog.now()
  WHERE id = p_membership_id
    AND status <> 'removed';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membership is already removed' USING errcode = 'P0002';
  END IF;

  INSERT INTO public.pfss_audit_log (
    organization_id, actor_id, action, entity_type, entity_id, metadata
  )
  VALUES (
    v_org_id, auth.uid(), 'membership.removed', 'membership', p_membership_id::text,
    pg_catalog.jsonb_build_object(
      'target_user_id', v_target_user_id,
      'target_role', v_target_role
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.pfss_org_revoke_invitation(p_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org_id uuid;
  v_email text;
  v_role text;
  v_actor_role text;
BEGIN
  IF auth.uid() IS NULL OR p_invitation_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING errcode = '42501';
  END IF;

  SELECT i.organization_id, i.email_normalized, i.role_detail
    INTO v_org_id, v_email, v_role
  FROM public.pfss_invitations AS i
  WHERE i.id = p_invitation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found' USING errcode = 'P0002';
  END IF;

  SELECT actor.role
    INTO v_actor_role
  FROM public.pfss_memberships AS actor
  JOIN public.pfss_organizations AS org ON org.id = actor.organization_id
  JOIN public.profiles AS profile ON profile.id = actor.user_id
  WHERE actor.organization_id = v_org_id
    AND actor.user_id = auth.uid()
    AND actor.status = 'active'
    AND org.status = 'active'
    AND profile.status = 'approved';

  IF v_actor_role IS NULL OR v_actor_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Not authorized' USING errcode = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.pfss_invitations AS i
    WHERE i.id = p_invitation_id
      AND (i.accepted_at IS NOT NULL OR i.revoked_at IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'Invitation is already accepted or revoked' USING errcode = '22023';
  END IF;

  UPDATE public.pfss_invitations
  SET revoked_at = pg_catalog.now()
  WHERE id = p_invitation_id
    AND accepted_at IS NULL
    AND revoked_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation could not be revoked' USING errcode = 'P0002';
  END IF;

  INSERT INTO public.pfss_audit_log (
    organization_id, actor_id, action, entity_type, entity_id, metadata
  )
  VALUES (
    v_org_id, auth.uid(), 'invitation.revoked', 'invitation', p_invitation_id::text,
    pg_catalog.jsonb_build_object('email', v_email, 'role', v_role)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pfss_org_remove_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pfss_org_revoke_invitation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pfss_org_remove_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pfss_org_revoke_invitation(uuid) TO authenticated;

COMMENT ON FUNCTION public.pfss_org_remove_member(uuid) IS
  'Removes a non-owner member only for an approved active organization owner/admin; admins cannot remove owners or other admins; self-removal is blocked and the action is audited.';
COMMENT ON FUNCTION public.pfss_org_revoke_invitation(uuid) IS
  'Revokes an unused invitation only for an approved active organization owner/admin; the action is audited and does not expose or store raw invitation tokens.';
