-- PFMS legacy invitation redemption guard.
-- A still-valid invitation must not enroll a user after its organization is suspended.
-- Additive and safe for existing invitation records; apply in STAGING first.

create or replace function public.pfms_apply_legacy_invitation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
  v_hash text;
  v_invitation public.organization_invitations%rowtype;
  v_org_status text;
begin
  -- Only the free member-registration route may redeem an organization invitation.
  if pg_catalog.lower(coalesce(new.raw_user_meta_data ->> 'registration_type', '')) <> 'user' then
    return new;
  end if;

  v_code := pg_catalog.upper(
    pg_catalog.regexp_replace(
      coalesce(new.raw_user_meta_data ->> 'invitation_code', ''),
      '[^A-Fa-f0-9]',
      '',
      'g'
    )
  );

  if v_code = '' then
    raise exception 'A valid organization invitation is required'
      using errcode = '22023';
  end if;

  v_hash := pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to(v_code, 'UTF8')),
    'hex'
  );

  select i.*
    into v_invitation
  from public.organization_invitations i
  where i.code_hash = v_hash
    and i.redeemed_at is null
    and i.revoked_at is null
    and i.expires_at > pg_catalog.now()
  for update;

  if not found then
    raise exception 'Invitation is invalid, expired, or already used'
      using errcode = '42501';
  end if;

  if v_invitation.role not in ('scout','trainer','co_trainer','betreuer','member') then
    raise exception 'Invitation contains an unsupported membership role'
      using errcode = '22023';
  end if;

  -- Lock the organization row while checking status and creating membership.
  -- A concurrent suspension must wait until this transaction finishes.
  select o.status
    into v_org_status
  from public.organizations o
  where o.id = v_invitation.organization_id
  for share;

  if not found or v_org_status not in ('approved','active') then
    raise exception 'Organization is not active or approved'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = v_invitation.organization_id
      and m.user_id = new.id
  ) then
    raise exception 'Membership already exists'
      using errcode = '23505';
  end if;

  insert into public.organization_memberships (
    organization_id, user_id, role, status
  )
  values (
    v_invitation.organization_id, new.id, v_invitation.role, 'active'
  );

  update public.organization_invitations
  set redeemed_at = pg_catalog.now(),
      redeemed_by = new.id
  where id = v_invitation.id
    and redeemed_at is null
    and revoked_at is null
    and expires_at > pg_catalog.now();

  if not found then
    raise exception 'Invitation was already redeemed or revoked'
      using errcode = '23505';
  end if;

  update public.profiles
  set role = case when v_invitation.role = 'scout' then 'scout' else 'user' end,
      status = 'approved',
      updated_at = pg_catalog.now()
  where id = new.id;

  return new;
end;
$$;

revoke all on function public.pfms_apply_legacy_invitation() from public, anon, authenticated;

comment on function public.pfms_apply_legacy_invitation() is
  'Redeems one-time legacy organization invitations only while the target organization is approved or active; row locks serialize redemption and organization suspension.';
