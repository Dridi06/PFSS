-- PFSS organization member management RPCs
-- Apply only to isolated PFSS-Test after 20261113_pfss_admin_and_invitation_rpcs.sql.
begin;

create or replace function public.pfss_org_list_members(p_organization_id uuid)
returns table(membership_id uuid,user_id uuid,username text,display_name text,email text,member_role text,member_status text,joined_at timestamptz)
language plpgsql stable security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if not public.pfss_has_org_role(p_organization_id,array['owner','admin']) then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  return query
    select m.id,m.user_id,p.username,p.display_name,u.email,m.role,m.status,m.created_at
    from public.pfss_memberships m
    left join public.profiles p on p.id=m.user_id
    left join auth.users u on u.id=m.user_id
    where m.organization_id=p_organization_id
    order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end,
      lower(coalesce(p.display_name,p.username,u.email,''));
end;
$$;

create or replace function public.pfss_org_list_invitations(p_organization_id uuid)
returns table(invitation_id uuid,email text,invite_role text,expires_at timestamptz,created_at timestamptz,revoked boolean,accepted boolean)
language plpgsql stable security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.pfss_has_org_role(p_organization_id,array['owner','admin']) then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  return query select i.id,i.email_normalized,i.role,i.expires_at,i.created_at,
    i.revoked_at is not null,i.accepted_at is not null
    from public.pfss_invitations i
    where i.organization_id=p_organization_id
    order by i.created_at desc;
end;
$$;

create or replace function public.pfss_org_update_member(
  p_membership_id uuid,p_role text,p_status text
) returns void
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare v_org uuid; v_old_role text; v_actor_role text;
begin
  if p_role not in ('admin','scout','coach','analyst','finance','viewer')
     or p_status not in ('active','suspended') then
    raise exception 'Invalid role or status' using errcode='22023';
  end if;
  select organization_id,role into v_org,v_old_role
    from public.pfss_memberships where id=p_membership_id for update;
  if not found then raise exception 'Membership not found' using errcode='P0002'; end if;
  select role into v_actor_role from public.pfss_memberships
    where organization_id=v_org and user_id=auth.uid() and status='active';
  if v_actor_role is null or v_actor_role not in ('owner','admin') then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  if v_old_role='owner' then raise exception 'Owner membership is protected'; end if;
  if v_actor_role='admin' and (v_old_role='admin' or p_role='admin') then
    raise exception 'Only the owner may manage administrator roles' using errcode='42501';
  end if;
  update public.pfss_memberships set role=p_role,status=p_status,updated_at=now()
   where id=p_membership_id;
  insert into public.pfss_audit_log(organization_id,actor_id,action,entity_type,entity_id,metadata)
   values(v_org,auth.uid(),'membership.updated','membership',p_membership_id::text,
     jsonb_build_object('role',p_role,'status',p_status));
end;
$$;

create or replace function public.pfss_org_remove_member(p_membership_id uuid)
returns void
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare v_org uuid; v_role text; v_actor_role text;
begin
  select organization_id,role into v_org,v_role from public.pfss_memberships
   where id=p_membership_id for update;
  if not found then raise exception 'Membership not found' using errcode='P0002'; end if;
  select role into v_actor_role from public.pfss_memberships
   where organization_id=v_org and user_id=auth.uid() and status='active';
  if v_actor_role is null or v_actor_role not in ('owner','admin') then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  if v_role='owner' then raise exception 'Owner membership cannot be removed'; end if;
  if v_actor_role='admin' and v_role='admin' then
    raise exception 'Only the owner may remove an administrator' using errcode='42501';
  end if;
  update public.pfss_memberships set status='removed',updated_at=now() where id=p_membership_id;
  insert into public.pfss_audit_log(organization_id,actor_id,action,entity_type,entity_id)
   values(v_org,auth.uid(),'membership.removed','membership',p_membership_id::text);
end;
$$;

create or replace function public.pfss_org_revoke_invitation(p_invitation_id uuid)
returns void
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare v_org uuid;
begin
  select organization_id into v_org from public.pfss_invitations
   where id=p_invitation_id and accepted_at is null and revoked_at is null for update;
  if not found then raise exception 'Invitation not found or already closed' using errcode='P0002'; end if;
  if not public.pfss_has_org_role(v_org,array['owner','admin']) then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  update public.pfss_invitations set revoked_at=now() where id=p_invitation_id;
  insert into public.pfss_audit_log(organization_id,actor_id,action,entity_type,entity_id)
   values(v_org,auth.uid(),'invitation.revoked','invitation',p_invitation_id::text);
end;
$$;

revoke all on function public.pfss_org_list_members(uuid) from public,anon;
revoke all on function public.pfss_org_list_invitations(uuid) from public,anon;
revoke all on function public.pfss_org_update_member(uuid,text,text) from public,anon;
revoke all on function public.pfss_org_remove_member(uuid) from public,anon;
revoke all on function public.pfss_org_revoke_invitation(uuid) from public,anon;
grant execute on function public.pfss_org_list_members(uuid) to authenticated;
grant execute on function public.pfss_org_list_invitations(uuid) to authenticated;
grant execute on function public.pfss_org_update_member(uuid,text,text) to authenticated;
grant execute on function public.pfss_org_remove_member(uuid) to authenticated;
grant execute on function public.pfss_org_revoke_invitation(uuid) to authenticated;

commit;
