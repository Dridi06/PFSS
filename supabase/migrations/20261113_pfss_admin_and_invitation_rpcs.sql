-- PFSS canonical admin and invitation RPCs
-- Uses pfss_organizations / pfss_memberships only. Legacy RPC names are retained
-- as API adapters for the current browser UI; no legacy org tables are required.
-- Apply after the core tenant foundation and mutation-hardening migrations.

begin;

create or replace function public.pfss_is_platform_admin()
returns boolean
language sql stable security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin','administrator')
      and p.status = 'approved'
  ) or exists (
    select 1 from public.pfss_platform_roles r
    where r.user_id = auth.uid() and r.role = 'platform_admin'
  );
$$;

revoke all on function public.pfss_is_platform_admin() from public, anon;
grant execute on function public.pfss_is_platform_admin() to authenticated;

create or replace function public.is_admin()
returns boolean language sql stable security definer
set search_path = pg_catalog, public
as $$ select public.pfss_is_platform_admin(); $$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create or replace function public.pfss_admin_list_profiles()
returns table(id uuid, username text, role text, status text)
language plpgsql stable security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.pfss_is_platform_admin() then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  return query
    select p.id,p.username,p.role,p.status
    from public.profiles p
    order by case p.status when 'pending' then 0 when 'approved' then 1 else 2 end,
             lower(coalesce(p.username,''));
end;
$$;

create or replace function public.pfss_admin_update_profile(
  p_user_id uuid,p_role text,p_status text
) returns void
language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.pfss_is_platform_admin() then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  if p_role not in ('user','scout','admin') then
    raise exception 'Invalid role' using errcode='22023';
  end if;
  if p_status not in ('pending','approved','suspended') then
    raise exception 'Invalid status' using errcode='22023';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot change your own administrator profile' using errcode='42501';
  end if;
  update public.profiles set role=p_role,status=p_status,updated_at=now()
  where id=p_user_id;
  if not found then raise exception 'Profile not found' using errcode='P0002'; end if;
end;
$$;

create or replace function public.pfms_admin_search_legacy_organizations(
  p_type text default null,p_query text default ''
) returns table(
  id uuid,organization_type text,name text,status text,created_at timestamptz,member_count bigint
)
language plpgsql stable security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.pfss_is_platform_admin() then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  if p_type is not null and p_type not in ('club','agency','scout_workspace') then
    raise exception 'Invalid organization type' using errcode='22023';
  end if;
  return query
  select o.id,o.organization_type,o.name,o.status,o.created_at,
         count(m.id) filter(where m.status='active')
  from public.pfss_organizations o
  left join public.pfss_memberships m on m.organization_id=o.id
  where (p_type is null or o.organization_type=p_type)
    and (coalesce(trim(p_query),'')='' or o.name ilike '%'||trim(p_query)||'%' or o.id::text ilike '%'||trim(p_query)||'%')
  group by o.id order by o.name;
end;
$$;

create or replace function public.pfms_admin_list_legacy_org_members(p_org_id uuid)
returns table(
  membership_id uuid,user_id uuid,username text,full_name text,email text,member_role text,status text
)
language plpgsql stable security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if not public.pfss_is_platform_admin() then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  return query
  select m.id,m.user_id,p.username,p.display_name,u.email,
    case m.role when 'owner' then 'owner' when 'admin' then 'club_admin'
      when 'coach' then 'trainer' else m.role end,
    case m.status when 'active' then 'active' when 'suspended' then 'suspended' else 'pending' end
  from public.pfss_memberships m
  left join public.profiles p on p.id=m.user_id
  left join auth.users u on u.id=m.user_id
  where m.organization_id=p_org_id
  order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end,
           lower(coalesce(p.username,p.display_name,u.email,''));
end;
$$;

create or replace function public.pfms_admin_update_legacy_membership(
  p_membership_id uuid,p_role text,p_status text
) returns void
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare v_org uuid; v_role text; v_status text;
begin
  if not public.pfss_is_platform_admin() then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  if p_role not in ('owner','club_admin','agency_admin','scout','trainer','co_trainer','betreuer','member') then
    raise exception 'Invalid membership role' using errcode='22023';
  end if;
  if p_status not in ('pending','active','suspended') then
    raise exception 'Invalid membership status' using errcode='22023';
  end if;
  select organization_id,role,status into v_org,v_role,v_status
  from public.pfss_memberships where id=p_membership_id for update;
  if not found then raise exception 'Membership not found' using errcode='P0002'; end if;
  if v_role='owner' and v_status='active'
     and (p_role<>'owner' or p_status<>'active')
     and not exists(select 1 from public.pfss_memberships x
       where x.organization_id=v_org and x.id<>p_membership_id and x.role='owner' and x.status='active') then
    raise exception 'The organization must retain at least one active owner';
  end if;
  update public.pfss_memberships
  set role=case p_role when 'club_admin' then 'admin' when 'agency_admin' then 'admin'
             when 'trainer' then 'coach' when 'co_trainer' then 'coach' else p_role end,
      status=case p_status when 'pending' then 'invited' else p_status end,
      updated_at=now()
  where id=p_membership_id;
end;
$$;

create or replace function public.pfms_admin_list_legacy_scouts(p_query text default '')
returns table(
 user_id uuid,username text,full_name text,email text,profile_status text,organization_count bigint
)
language plpgsql stable security definer
set search_path = pg_catalog, public, auth
as $$
begin
 if not public.pfss_is_platform_admin() then
   raise exception 'Not authorized' using errcode='42501';
 end if;
 return query
 select p.id,p.username,p.display_name,u.email,p.status,
   count(distinct m.organization_id) filter(where m.status='active')
 from public.profiles p
 left join auth.users u on u.id=p.id
 left join public.pfss_memberships m on m.user_id=p.id and m.role='scout'
 where (p.role='scout' or m.id is not null)
   and (coalesce(trim(p_query),'')='' or
     coalesce(p.username,'') ilike '%'||trim(p_query)||'%' or
     coalesce(p.display_name,'') ilike '%'||trim(p_query)||'%' or
     coalesce(u.email,'') ilike '%'||trim(p_query)||'%' or p.id::text ilike '%'||trim(p_query)||'%')
 group by p.id,p.username,p.display_name,u.email,p.status
 order by lower(coalesce(p.username,p.display_name,u.email,''));
end;
$$;

create or replace function public.pfms_create_legacy_invitation(
 p_organization_id uuid,p_role text default 'scout',p_expires_in_days integer default 7
) returns text
language plpgsql security definer
set search_path = pg_catalog, public, extensions
as $$
declare v_code text; v_org_status text;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_role not in ('scout','trainer','co_trainer','betreuer','member') then
   raise exception 'Role cannot be assigned by invitation' using errcode='22023';
 end if;
 if p_expires_in_days not between 1 and 30 then
   raise exception 'Invitation validity must be between 1 and 30 days' using errcode='22023';
 end if;
 if not public.pfss_has_org_role(p_organization_id,array['owner','admin']) then
   raise exception 'Not authorized to invite members' using errcode='42501';
 end if;
 select status into v_org_status from public.pfss_organizations where id=p_organization_id for share;
 if not found or v_org_status<>'active' then raise exception 'Organization is not active'; end if;
 v_code:=upper(replace(gen_random_uuid()::text,'-',''));
 insert into public.pfss_invitations(organization_id,email_normalized,role,token_hash,expires_at,created_by)
 values(p_organization_id,'*',p_role,encode(digest(convert_to(v_code,'UTF8'),'sha256'),'hex'),
        now()+make_interval(days=>p_expires_in_days),auth.uid());
 return v_code;
end;
$$;

-- Atomic, one-time invitation redemption. The invite token is supplied in
-- signup metadata; only its hash is persisted. Profile approval and membership
-- creation happen in the same Auth-user transaction.
create or replace function public.pfss_apply_signup_invitation()
returns trigger
language plpgsql security definer
set search_path = pg_catalog, public, extensions
as $$
declare v_code text; v_hash text; v_inv public.pfss_invitations%rowtype;
begin
 if lower(coalesce(new.raw_user_meta_data->>'registration_type','')) <> 'user' then
   return new;
 end if;
 v_code:=upper(regexp_replace(coalesce(new.raw_user_meta_data->>'invitation_code',''),'[^A-Fa-f0-9]','','g'));
 if v_code='' then raise exception 'A valid organization invitation is required'; end if;
 v_hash:=encode(digest(convert_to(v_code,'UTF8'),'sha256'),'hex');
 select * into v_inv from public.pfss_invitations
 where token_hash=v_hash and accepted_at is null and revoked_at is null and expires_at>now()
 for update;
 if not found then raise exception 'Invitation is invalid, expired, or already used'; end if;
 if exists(select 1 from public.pfss_memberships where organization_id=v_inv.organization_id and user_id=new.id) then
   raise exception 'Membership already exists';
 end if;
 insert into public.pfss_memberships(organization_id,user_id,role,status)
 values(v_inv.organization_id,new.id,
   case v_inv.role when 'trainer' then 'coach' when 'co_trainer' then 'coach' else v_inv.role end,'active');
 update public.pfss_invitations set accepted_at=now() where id=v_inv.id;
 update public.profiles set role=case when v_inv.role='scout' then 'scout' else 'user' end,status='approved'
 where id=new.id;
 return new;
end;
$$;

drop trigger if exists zz_pfss_apply_signup_invitation on auth.users;
create trigger zz_pfss_apply_signup_invitation
after insert on auth.users
for each row execute function public.pfss_apply_signup_invitation();

revoke all on function public.pfss_admin_list_profiles() from public,anon;
revoke all on function public.pfss_admin_update_profile(uuid,text,text) from public,anon;
revoke all on function public.pfms_admin_search_legacy_organizations(text,text) from public,anon;
revoke all on function public.pfms_admin_list_legacy_org_members(uuid) from public,anon;
revoke all on function public.pfms_admin_update_legacy_membership(uuid,text,text) from public,anon;
revoke all on function public.pfms_admin_list_legacy_scouts(text) from public,anon;
revoke all on function public.pfms_create_legacy_invitation(uuid,text,integer) from public,anon;
revoke all on function public.pfss_apply_signup_invitation() from public,anon,authenticated;

grant execute on function public.pfss_admin_list_profiles() to authenticated;
grant execute on function public.pfss_admin_update_profile(uuid,text,text) to authenticated;
grant execute on function public.pfms_admin_search_legacy_organizations(text,text) to authenticated;
grant execute on function public.pfms_admin_list_legacy_org_members(uuid) to authenticated;
grant execute on function public.pfms_admin_update_legacy_membership(uuid,text,text) to authenticated;
grant execute on function public.pfms_admin_list_legacy_scouts(text) to authenticated;
grant execute on function public.pfms_create_legacy_invitation(uuid,text,integer) to authenticated;

comment on function public.pfss_is_platform_admin() is
 'Platform administrator check for authenticated RPCs; platform role or approved legacy-compatible admin profile.';

commit;
