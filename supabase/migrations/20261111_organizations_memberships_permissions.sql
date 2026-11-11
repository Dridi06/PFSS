-- PFMS organization, membership and permission foundation
-- Safe additive migration: creates new tables/functions only; existing data is preserved.
-- Run once in Supabase SQL Editor after reviewing.

create extension if not exists pgcrypto;

create table if not exists public.pfms_organizations (
  id uuid primary key default gen_random_uuid(),
  organization_code text not null unique default ('ORG-' || upper(substr(encode(gen_random_bytes(6),'hex'),1,10))),
  organization_type text not null check (organization_type in ('club','agency')),
  name text not null check (length(trim(name)) between 2 and 120),
  created_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'active' check (status in ('active','pending','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pfms_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.pfms_organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  member_role text not null default 'member' check (member_role in ('owner','admin','manager','scout','coach','member')),
  status text not null default 'active' check (status in ('invited','active','suspended')),
  permissions jsonb not null default '{"view_players":true,"create_players":false,"edit_players":false,"delete_players":false,"view_reports":true,"create_reports":false,"manage_members":false}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,user_id)
);

create table if not exists public.pfms_scout_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  scout_code text not null unique default ('SC-' || upper(substr(encode(gen_random_bytes(6),'hex'),1,10))),
  scout_type text not null default 'solo_scout',
  display_name text,
  status text not null default 'active' check (status in ('active','pending','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pfms_org_name_search_idx on public.pfms_organizations using gin (to_tsvector('simple', name));
create index if not exists pfms_memberships_user_idx on public.pfms_memberships(user_id);
create index if not exists pfms_memberships_org_idx on public.pfms_memberships(organization_id);

create or replace function public.pfms_is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role,'')) in ('admin','administrator')
      and lower(coalesce(p.status,'')) = 'approved'
  );
$$;

create or replace function public.pfms_is_org_member(p_org_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.pfms_memberships m
    join public.pfms_organizations o on o.id=m.organization_id
    where m.organization_id=p_org_id and m.user_id=auth.uid()
      and m.status='active' and o.status='active'
  );
$$;

alter table public.pfms_organizations enable row level security;
alter table public.pfms_memberships enable row level security;
alter table public.pfms_scout_profiles enable row level security;

drop policy if exists pfms_org_read on public.pfms_organizations;
create policy pfms_org_read on public.pfms_organizations
for select to authenticated
using (public.pfms_is_admin() or public.pfms_is_org_member(id));

drop policy if exists pfms_membership_read on public.pfms_memberships;
create policy pfms_membership_read on public.pfms_memberships
for select to authenticated
using (public.pfms_is_admin() or user_id=auth.uid() or public.pfms_is_org_member(organization_id));

drop policy if exists pfms_scout_profile_read on public.pfms_scout_profiles;
create policy pfms_scout_profile_read on public.pfms_scout_profiles
for select to authenticated
using (public.pfms_is_admin() or user_id=auth.uid());

-- Signup provisioning. Organization IDs and scout IDs are generated server-side.
create or replace function public.pfms_provision_new_account()
returns trigger
language plpgsql security definer
set search_path = public, auth
as $$
declare
  v_type text;
  v_name text;
  v_org_id uuid;
  v_scout_type text;
begin
  v_type := lower(coalesce(new.raw_user_meta_data->>'registration_type',''));
  v_name := trim(coalesce(new.raw_user_meta_data->>'organization_name',''));

  if v_type in ('club','agency') and length(v_name) between 2 and 120 then
    insert into public.pfms_organizations(organization_type,name,created_by)
    values (v_type,v_name,new.id)
    returning id into v_org_id;

    insert into public.pfms_memberships(organization_id,user_id,member_role,status,permissions)
    values (
      v_org_id,new.id,'owner','active',
      '{"view_players":true,"create_players":true,"edit_players":true,"delete_players":true,"view_reports":true,"create_reports":true,"manage_members":true}'::jsonb
    ) on conflict (organization_id,user_id) do nothing;
  elsif v_type='scout' then
    v_scout_type := coalesce(nullif(new.raw_user_meta_data->>'scout_type',''),'solo_scout');
    insert into public.pfms_scout_profiles(user_id,scout_type,display_name)
    values (new.id,v_scout_type,nullif(trim(coalesce(new.raw_user_meta_data->>'username','')),''))
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists pfms_provision_new_account on auth.users;
create trigger pfms_provision_new_account
after insert on auth.users
for each row execute function public.pfms_provision_new_account();

-- Admin search across clubs and agencies. Search may match name or organization code.
create or replace function public.pfms_admin_search_organizations(p_type text default null,p_query text default '')
returns table(id uuid,organization_code text,organization_type text,name text,status text,created_at timestamptz,member_count bigint)
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.pfms_is_admin() then raise exception 'Not authorized' using errcode='42501'; end if;
  if p_type is not null and p_type not in ('club','agency') then raise exception 'Invalid organization type'; end if;
  return query
    select o.id,o.organization_code,o.organization_type,o.name,o.status,o.created_at,
      count(m.id) filter (where m.status='active')
    from public.pfms_organizations o
    left join public.pfms_memberships m on m.organization_id=o.id
    where (p_type is null or o.organization_type=p_type)
      and (coalesce(trim(p_query),'')='' or o.name ilike '%'||trim(p_query)||'%' or o.organization_code ilike '%'||trim(p_query)||'%')
    group by o.id
    order by o.name;
end;
$$;

create or replace function public.pfms_admin_list_org_members(p_org_id uuid)
returns table(membership_id uuid,user_id uuid,username text,email text,member_role text,status text,permissions jsonb)
language plpgsql security definer
set search_path = public, auth
as $$
begin
  if not public.pfms_is_admin() then raise exception 'Not authorized' using errcode='42501'; end if;
  return query
    select m.id,m.user_id,p.username,u.email,m.member_role,m.status,m.permissions
    from public.pfms_memberships m
    left join public.profiles p on p.id=m.user_id
    left join auth.users u on u.id=m.user_id
    where m.organization_id=p_org_id
    order by case m.member_role when 'owner' then 0 when 'admin' then 1 else 2 end, lower(coalesce(p.username,u.email,''));
end;
$$;

create or replace function public.pfms_admin_update_membership(
  p_membership_id uuid,p_member_role text,p_status text,p_permissions jsonb
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare v_permissions jsonb;
begin
  if not public.pfms_is_admin() then raise exception 'Not authorized' using errcode='42501'; end if;
  if p_member_role not in ('owner','admin','manager','scout','coach','member') then raise exception 'Invalid member role'; end if;
  if p_status not in ('invited','active','suspended') then raise exception 'Invalid membership status'; end if;
  if jsonb_typeof(p_permissions) <> 'object' then raise exception 'Invalid permissions'; end if;
  if exists (
    select 1 from jsonb_each(p_permissions) e
    where e.key not in ('view_players','create_players','edit_players','delete_players','view_reports','create_reports','manage_members')
       or jsonb_typeof(e.value) <> 'boolean'
  ) then raise exception 'Invalid permission key or value'; end if;
  v_permissions := coalesce(p_permissions,'{}'::jsonb);
  update public.pfms_memberships
  set member_role=p_member_role,status=p_status,permissions=v_permissions,updated_at=now()
  where id=p_membership_id;
  if not found then raise exception 'Membership not found'; end if;
end;
$$;

create or replace function public.pfms_admin_list_scouts(p_query text default '')
returns table(user_id uuid,scout_code text,scout_type text,display_name text,status text,username text,email text)
language plpgsql security definer
set search_path = public, auth
as $$
begin
  if not public.pfms_is_admin() then raise exception 'Not authorized' using errcode='42501'; end if;
  return query
    select s.user_id,s.scout_code,s.scout_type,s.display_name,s.status,p.username,u.email
    from public.pfms_scout_profiles s
    left join public.profiles p on p.id=s.user_id
    left join auth.users u on u.id=s.user_id
    where coalesce(p_query,'')='' or coalesce(s.display_name,p.username,u.email,'') ilike '%'||trim(p_query)||'%' or s.scout_code ilike '%'||trim(p_query)||'%'
    order by lower(coalesce(s.display_name,p.username,u.email,''));
end;
$$;

revoke all on function public.pfms_is_admin() from public,anon;
revoke all on function public.pfms_is_org_member(uuid) from public,anon;
revoke all on function public.pfms_admin_search_organizations(text,text) from public,anon;
revoke all on function public.pfms_admin_list_org_members(uuid) from public,anon;
revoke all on function public.pfms_admin_update_membership(uuid,text,text,jsonb) from public,anon;
revoke all on function public.pfms_admin_list_scouts(text) from public,anon;
grant execute on function public.pfms_is_admin() to authenticated;
grant execute on function public.pfms_is_org_member(uuid) to authenticated;
grant execute on function public.pfms_admin_search_organizations(text,text) to authenticated;
grant execute on function public.pfms_admin_list_org_members(uuid) to authenticated;
grant execute on function public.pfms_admin_update_membership(uuid,text,text,jsonb) to authenticated;
grant execute on function public.pfms_admin_list_scouts(text) to authenticated;
