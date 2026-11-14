-- PFMS one-time platform owner bootstrap
-- Safe additive migration. Apply in STAGING only after reviewing the current schema.
-- The bootstrap secret is stored only in Supabase Edge Function secrets, never here.

create table if not exists public.pfms_platform_owner (
  singleton boolean primary key default true check (singleton is true),
  owner_user_id uuid not null unique references auth.users(id) on delete restrict,
  claimed_at timestamptz not null default pg_catalog.now()
);

alter table public.pfms_platform_owner enable row level security;
revoke all on table public.pfms_platform_owner from public, anon, authenticated;

create or replace function public.pfms_owner_setup_available()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    not exists (
      select 1
      from public.pfms_platform_owner
      where singleton is true
    )
    and not exists (
      select 1
      from public.profiles p
      where lower(coalesce(p.role, '')) in ('admin', 'administrator')
        and lower(coalesce(p.status, '')) = 'approved'
    );
$$;

revoke all on function public.pfms_owner_setup_available() from public, anon;
grant execute on function public.pfms_owner_setup_available() to authenticated;

create or replace function public.pfms_claim_initial_owner(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- This RPC is callable only by the server-side service-role client.
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_user_id is null or not exists (
    select 1 from auth.users where id = p_user_id
  ) then
    raise exception 'User not found' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.pfms_platform_owner where singleton is true
  ) then
    raise exception 'Platform owner is already configured' using errcode = '23505';
  end if;

  -- Do not create a second root identity if the legacy platform already has
  -- an approved administrator. Such installations require a reviewed manual
  -- owner assignment after the staging schema/data audit.
  if exists (
    select 1
    from public.profiles p
    where p.id <> p_user_id
      and lower(coalesce(p.role, '')) in ('admin', 'administrator')
      and lower(coalesce(p.status, '')) = 'approved'
  ) then
    raise exception 'An approved administrator already exists; initial owner bootstrap is disabled'
      using errcode = '42501';
  end if;

  update public.profiles
  set role = 'admin',
      status = 'approved'
  where id = p_user_id;

  if not found then
    raise exception 'User profile not found' using errcode = 'P0002';
  end if;

  -- The singleton key plus transaction rollback prevents two simultaneous claims.
  insert into public.pfms_platform_owner (singleton, owner_user_id, claimed_at)
  values (true, p_user_id, pg_catalog.now());
end;
$$;

revoke all on function public.pfms_claim_initial_owner(uuid) from public, anon, authenticated;
grant execute on function public.pfms_claim_initial_owner(uuid) to service_role;

comment on table public.pfms_platform_owner is
  'Single platform owner record. The owner is provisioned only through the authenticated, one-time Edge Function.';
