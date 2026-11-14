-- PFMS owner bootstrap registration guard
-- The eligibility record is written only by the auth.users INSERT trigger.
-- User-editable auth.user_metadata is not sufficient proof of the original
-- registration route because users can change user_metadata after signup.

create table if not exists public.pfms_owner_bootstrap_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  requested_at timestamptz not null default pg_catalog.now(),
  claimed_at timestamptz
);

alter table public.pfms_owner_bootstrap_requests enable row level security;
revoke all on table public.pfms_owner_bootstrap_requests from public, anon, authenticated;

create or replace function public.pfms_register_owner_bootstrap_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if pg_catalog.lower(
    pg_catalog.coalesce(new.raw_user_meta_data ->> 'registration_type', '')
  ) = 'owner_bootstrap' then
    insert into public.pfms_owner_bootstrap_requests(user_id)
    values (new.id)
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function public.pfms_register_owner_bootstrap_request() from public, anon, authenticated;

drop trigger if exists pfms_register_owner_bootstrap_request on auth.users;
create trigger pfms_register_owner_bootstrap_request
after insert on auth.users
for each row
execute function public.pfms_register_owner_bootstrap_request();

create or replace function public.pfms_owner_setup_available()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and exists (
      select 1
      from public.pfms_owner_bootstrap_requests r
      where r.user_id = auth.uid()
        and r.claimed_at is null
    )
    and not exists (
      select 1
      from public.pfms_platform_owner
      where singleton is true
    )
    and not exists (
      select 1
      from public.profiles p
      where pg_catalog.lower(pg_catalog.coalesce(p.role, '')) in ('admin', 'administrator')
        and pg_catalog.lower(pg_catalog.coalesce(p.status, '')) = 'approved'
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
declare
  v_request public.pfms_owner_bootstrap_requests%rowtype;
begin
  if pg_catalog.coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_user_id is null or not exists (
    select 1 from auth.users where id = p_user_id
  ) then
    raise exception 'User not found' using errcode = '22023';
  end if;

  select * into v_request
  from public.pfms_owner_bootstrap_requests
  where user_id = p_user_id
    and claimed_at is null
  for update;

  if not found then
    raise exception 'Owner registration request not found or already claimed'
      using errcode = '42501';
  end if;

  if exists (
    select 1 from public.pfms_platform_owner where singleton is true
  ) then
    raise exception 'Platform owner is already configured' using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.profiles p
    where p.id <> p_user_id
      and pg_catalog.lower(pg_catalog.coalesce(p.role, '')) in ('admin', 'administrator')
      and pg_catalog.lower(pg_catalog.coalesce(p.status, '')) = 'approved'
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

  insert into public.pfms_platform_owner (singleton, owner_user_id, claimed_at)
  values (true, p_user_id, pg_catalog.now());

  update public.pfms_owner_bootstrap_requests
  set claimed_at = pg_catalog.now()
  where user_id = p_user_id
    and claimed_at is null;

  if not found then
    raise exception 'Owner registration request was already claimed'
      using errcode = '23505';
  end if;
end;
$$;

revoke all on function public.pfms_claim_initial_owner(uuid) from public, anon, authenticated;
grant execute on function public.pfms_claim_initial_owner(uuid) to service_role;

comment on table public.pfms_owner_bootstrap_requests is
  'Immutable evidence that the user selected the dedicated owner registration route at initial auth.users creation. The user cannot read or modify this table.';
