-- PFSS: sichere Einladungen fuer bestehende Vereine und Agenturen
-- Einmalige Einladungscodes; Speicherung ausschliesslich als SHA-256-Hash.
-- Bestehende Tabellen, Policies und Auth-Profil-Trigger bleiben erhalten.

CREATE TABLE IF NOT EXISTS public.organization_invitations (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  code_hash text NOT NULL UNIQUE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('scout','trainer','co_trainer','betreuer','member')),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  expires_at timestamptz NOT NULL,
  redeemed_at timestamptz,
  redeemed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS organization_invitations_org_idx
  ON public.organization_invitations (organization_id, created_at DESC);

ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

-- Kein direkter Tabellenzugriff fuer Browser-Rollen.
REVOKE ALL ON TABLE public.organization_invitations FROM PUBLIC, anon, authenticated;

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

  IF NOT public.can_manage_org(p_organization_id) THEN
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

CREATE OR REPLACE FUNCTION public.pfms_apply_legacy_invitation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_code text;
  v_hash text;
  v_invitation public.organization_invitations%ROWTYPE;
BEGIN
  -- Nur die kostenlose Mitgliederregistrierung benoetigt eine Einladung.
  IF pg_catalog.lower(COALESCE(NEW.raw_user_meta_data ->> 'registration_type', '')) <> 'user' THEN
    RETURN NEW;
  END IF;

  v_code := pg_catalog.upper(
    pg_catalog.regexp_replace(
      COALESCE(NEW.raw_user_meta_data ->> 'invitation_code', ''),
      '[^A-Fa-f0-9]',
      '',
      'g'
    )
  );

  IF v_code = '' THEN
    RAISE EXCEPTION 'A valid organization invitation is required';
  END IF;

  v_hash := pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to(v_code, 'UTF8')),
    'hex'
  );

  SELECT i.*
  INTO v_invitation
  FROM public.organization_invitations AS i
  WHERE i.code_hash = v_hash
    AND i.redeemed_at IS NULL
    AND i.revoked_at IS NULL
    AND i.expires_at > pg_catalog.now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation is invalid, expired, or already used';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.organization_memberships AS m
    WHERE m.organization_id = v_invitation.organization_id
      AND m.user_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'Membership already exists';
  END IF;

  INSERT INTO public.organization_memberships (
    organization_id, user_id, role, status
  )
  VALUES (
    v_invitation.organization_id, NEW.id, v_invitation.role, 'active'
  );

  UPDATE public.organization_invitations
  SET redeemed_at = pg_catalog.now(),
      redeemed_by = NEW.id
  WHERE id = v_invitation.id;

  UPDATE public.profiles
  SET role = CASE WHEN v_invitation.role = 'scout' THEN 'scout' ELSE 'user' END,
      status = 'approved',
      updated_at = pg_catalog.now()
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS zz_pfms_apply_legacy_invitation ON auth.users;
CREATE TRIGGER zz_pfms_apply_legacy_invitation
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.pfms_apply_legacy_invitation();

REVOKE ALL ON FUNCTION public.pfms_create_legacy_invitation(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pfms_create_legacy_invitation(uuid, text, integer) TO authenticated;
REVOKE ALL ON FUNCTION public.pfms_apply_legacy_invitation() FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.organization_invitations IS
  'One-time invitation tokens for legacy organizations; raw tokens are never stored.';
