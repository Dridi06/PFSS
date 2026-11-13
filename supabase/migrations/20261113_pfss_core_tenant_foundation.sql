-- PFSS core tenant foundation
-- Version: 2026-11-13
-- Target: isolated PFSS-Test only. Do NOT apply to production without separate review.
-- Creates the canonical organization model and first tenant-scoped modules.
-- No production data is read, copied, or modified.

begin;

create extension if not exists pgcrypto with schema extensions;

-- 1. Profiles: one application profile per Supabase Auth user.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  status text not null default 'active'
    check (status in ('active','invited','suspended','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Global platform roles are intentionally separate from tenant membership roles.
create table if not exists public.pfss_platform_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('platform_admin','support')),
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id) on delete set null
);

-- 2. Canonical tenant model. Do not create a second organizations/memberships model.
create table if not exists public.pfss_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 160),
  organization_type text not null
    check (organization_type in ('club','agency','academy','scouting_network','other')),
  slug text unique,
  status text not null default 'active'
    check (status in ('active','suspended','archived')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pfss_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.pfss_organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','scout','coach','analyst','finance','viewer')),
  status text not null default 'active'
    check (status in ('active','invited','suspended','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,user_id),
  unique (organization_id,id)
);
create index if not exists pfss_memberships_user_org_idx
  on public.pfss_memberships(user_id,organization_id) where status='active';

-- Invitation tokens are stored only as SHA-256 hashes. Raw tokens are returned
-- once by a trusted server endpoint, never stored in this table.
create table if not exists public.pfss_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.pfss_organizations(id) on delete cascade,
  email_normalized text not null,
  role text not null check (role in ('admin','scout','coach','analyst','finance','viewer')),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index if not exists pfss_invitations_org_idx
  on public.pfss_invitations(organization_id,created_at desc);

-- 3. Core club/scouting records.
create table if not exists public.pfss_teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.pfss_organizations(id) on delete cascade,
  name text not null,
  age_group text,
  competition text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,id)
);
create table if not exists public.pfss_players (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.pfss_organizations(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  birth_date date,
  nationality text,
  position text,
  preferred_foot text check (preferred_foot is null or preferred_foot in ('LF','RF','Beidfüßig')),
  current_team_id uuid,
  height_cm integer check (height_cm is null or height_cm between 100 and 250),
  notes text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,id),
  constraint pfss_players_team_same_org_fk
    foreign key (organization_id,current_team_id)
    references public.pfss_teams(organization_id,id) on delete set null (current_team_id)
);
create index if not exists pfss_players_org_name_idx
  on public.pfss_players(organization_id,last_name,first_name);

create table if not exists public.pfss_scouting_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.pfss_organizations(id) on delete cascade,
  player_id uuid not null,
  author_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  observation_date date not null default current_date,
  overall_rating numeric(3,1) check (overall_rating is null or overall_rating between 0 and 10),
  scores jsonb not null default '{}'::jsonb,
  strengths text,
  development_areas text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,id),
  constraint pfss_reports_player_same_org_fk
    foreign key (organization_id,player_id)
    references public.pfss_players(organization_id,id) on delete cascade
);
create index if not exists pfss_reports_org_player_date_idx
  on public.pfss_scouting_reports(organization_id,player_id,observation_date desc);

create table if not exists public.pfss_media (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.pfss_organizations(id) on delete cascade,
  player_id uuid,
  uploaded_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  bucket_id text not null default 'pfss-tenant-private',
  storage_path text not null unique,
  media_type text not null check (media_type in ('photo','video','document')),
  mime_type text,
  file_size bigint check (file_size is null or file_size between 0 and 104857600),
  created_at timestamptz not null default now(),
  constraint pfss_media_player_same_org_fk
    foreign key (organization_id,player_id)
    references public.pfss_players(organization_id,id) on delete cascade
);

-- 4. Organization tasks and calendar.
create table if not exists public.pfss_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.pfss_organizations(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'open' check (status in ('open','in_progress','done','cancelled')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  assigned_to uuid references auth.users(id) on delete set null,
  due_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.pfss_calendar_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.pfss_organizations(id) on delete cascade,
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);

-- 5. Append-only audit events. Application writes are restricted to authenticated
-- members through RLS; privileged server-side audit can use service_role.
create table if not exists public.pfss_audit_log (
  id bigint generated always as identity primary key,
  organization_id uuid references public.pfss_organizations(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists pfss_audit_org_created_idx
  on public.pfss_audit_log(organization_id,created_at desc);

-- 6. Authorization helper. SECURITY DEFINER avoids recursive membership RLS;
-- fixed search_path and explicit function grants are mandatory.
create or replace function public.pfss_has_org_role(
  p_organization_id uuid,
  p_allowed_roles text[] default null
) returns boolean
language sql stable security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.pfss_memberships m
    where m.organization_id = p_organization_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and (p_allowed_roles is null or m.role = any(p_allowed_roles))
  );
$$;
revoke all on function public.pfss_has_org_role(uuid,text[]) from public,anon;
grant execute on function public.pfss_has_org_role(uuid,text[]) to authenticated;

-- 7. Profile bootstrap for newly registered Auth users.
create or replace function public.pfss_handle_new_auth_user()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.profiles(id,username,display_name)
  values (
    new.id,
    nullif(lower(trim(new.raw_user_meta_data ->> 'username')),''),
    nullif(trim(new.raw_user_meta_data ->> 'display_name'),'')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.pfss_handle_new_auth_user() from public,anon,authenticated;
drop trigger if exists pfss_on_auth_user_created on auth.users;
create trigger pfss_on_auth_user_created
after insert on auth.users
for each row execute function public.pfss_handle_new_auth_user();

-- 8. Enable RLS everywhere and grant only the required client operations.
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','pfss_platform_roles','pfss_organizations','pfss_memberships',
    'pfss_invitations','pfss_teams','pfss_players','pfss_scouting_reports',
    'pfss_media','pfss_tasks','pfss_calendar_events','pfss_audit_log'
  ] loop
    execute format('alter table public.%I enable row level security',t);
  end loop;
end $$;

revoke all on public.profiles,public.pfss_platform_roles,public.pfss_organizations,
  public.pfss_memberships,public.pfss_invitations,public.pfss_teams,
  public.pfss_players,public.pfss_scouting_reports,public.pfss_media,
  public.pfss_tasks,public.pfss_calendar_events,public.pfss_audit_log
from public,anon;
grant select,update on public.profiles to authenticated;
grant select on public.pfss_platform_roles to authenticated;
grant select,insert,update on public.pfss_organizations to authenticated;
grant select,insert,update,delete on public.pfss_memberships to authenticated;
grant select,insert,update on public.pfss_invitations to authenticated;
grant select,insert,update,delete on public.pfss_teams,public.pfss_players,
  public.pfss_scouting_reports,public.pfss_media,public.pfss_tasks,
  public.pfss_calendar_events to authenticated;
grant select,insert on public.pfss_audit_log to authenticated;
grant usage,select on sequence public.pfss_audit_log_id_seq to authenticated;

-- Profiles: users may see and update only their own profile. Platform roles
-- cannot be self-assigned because no INSERT/DELETE grant or policy is provided.
drop policy if exists pfss_profiles_select_self on public.profiles;
create policy pfss_profiles_select_self on public.profiles
for select to authenticated using (id=auth.uid());
drop policy if exists pfss_profiles_update_self on public.profiles;
create policy pfss_profiles_update_self on public.profiles
for update to authenticated using (id=auth.uid()) with check (id=auth.uid());

drop policy if exists pfss_platform_roles_read_self on public.pfss_platform_roles;
create policy pfss_platform_roles_read_self on public.pfss_platform_roles
for select to authenticated using (user_id=auth.uid());

drop policy if exists pfss_org_select_member on public.pfss_organizations;
create policy pfss_org_select_member on public.pfss_organizations
for select to authenticated using (public.pfss_has_org_role(id));
drop policy if exists pfss_org_insert_creator on public.pfss_organizations;
create policy pfss_org_insert_creator on public.pfss_organizations
for insert to authenticated with check (created_by=auth.uid());
drop policy if exists pfss_org_update_admin on public.pfss_organizations;
create policy pfss_org_update_admin on public.pfss_organizations
for update to authenticated using (public.pfss_has_org_role(id,array['owner','admin']))
with check (public.pfss_has_org_role(id,array['owner','admin']));

drop policy if exists pfss_memberships_select_org on public.pfss_memberships;
create policy pfss_memberships_select_org on public.pfss_memberships
for select to authenticated using (public.pfss_has_org_role(organization_id));
drop policy if exists pfss_memberships_insert_admin on public.pfss_memberships;
create policy pfss_memberships_insert_admin on public.pfss_memberships
for insert to authenticated with check (public.pfss_has_org_role(organization_id,array['owner','admin']));
drop policy if exists pfss_memberships_update_admin on public.pfss_memberships;
create policy pfss_memberships_update_admin on public.pfss_memberships
for update to authenticated using (public.pfss_has_org_role(organization_id,array['owner','admin']))
with check (public.pfss_has_org_role(organization_id,array['owner','admin']));
drop policy if exists pfss_memberships_delete_owner on public.pfss_memberships;
create policy pfss_memberships_delete_owner on public.pfss_memberships
for delete to authenticated using (public.pfss_has_org_role(organization_id,array['owner']));

drop policy if exists pfss_invitations_select_admin on public.pfss_invitations;
create policy pfss_invitations_select_admin on public.pfss_invitations
for select to authenticated using (public.pfss_has_org_role(organization_id,array['owner','admin']));
drop policy if exists pfss_invitations_insert_admin on public.pfss_invitations;
create policy pfss_invitations_insert_admin on public.pfss_invitations
for insert to authenticated with check (public.pfss_has_org_role(organization_id,array['owner','admin']) and created_by=auth.uid());
drop policy if exists pfss_invitations_update_admin on public.pfss_invitations;
create policy pfss_invitations_update_admin on public.pfss_invitations
for update to authenticated using (public.pfss_has_org_role(organization_id,array['owner','admin']))
with check (public.pfss_has_org_role(organization_id,array['owner','admin']));

-- Module records: all active org members can read; writes are limited to
-- owner/admin/scout/coach/analyst as appropriate.
do $$
declare t text;
begin
  foreach t in array array['pfss_teams','pfss_players','pfss_scouting_reports','pfss_media','pfss_tasks','pfss_calendar_events']
  loop
    execute format('drop policy if exists %I on public.%I',t||'_select_member',t);
    execute format('create policy %I on public.%I for select to authenticated using (public.pfss_has_org_role(organization_id))',t||'_select_member',t);
  end loop;
end $$;

create policy pfss_teams_write on public.pfss_teams
for all to authenticated using (public.pfss_has_org_role(organization_id,array['owner','admin','coach']))
with check (public.pfss_has_org_role(organization_id,array['owner','admin','coach']));
create policy pfss_players_write on public.pfss_players
for all to authenticated using (public.pfss_has_org_role(organization_id,array['owner','admin','scout','coach']))
with check (public.pfss_has_org_role(organization_id,array['owner','admin','scout','coach']));
create policy pfss_reports_write on public.pfss_scouting_reports
for all to authenticated using (public.pfss_has_org_role(organization_id,array['owner','admin','scout','analyst']))
with check (public.pfss_has_org_role(organization_id,array['owner','admin','scout','analyst']));
create policy pfss_media_write on public.pfss_media
for all to authenticated using (public.pfss_has_org_role(organization_id,array['owner','admin','scout','analyst']))
with check (public.pfss_has_org_role(organization_id,array['owner','admin','scout','analyst']));
create policy pfss_tasks_write on public.pfss_tasks
for all to authenticated using (public.pfss_has_org_role(organization_id,array['owner','admin','scout','coach','analyst']))
with check (public.pfss_has_org_role(organization_id,array['owner','admin','scout','coach','analyst']));
create policy pfss_calendar_events_write on public.pfss_calendar_events
for all to authenticated using (public.pfss_has_org_role(organization_id,array['owner','admin','scout','coach','analyst']))
with check (public.pfss_has_org_role(organization_id,array['owner','admin','scout','coach','analyst']));

drop policy if exists pfss_audit_select_admin on public.pfss_audit_log;
create policy pfss_audit_select_admin on public.pfss_audit_log
for select to authenticated using (
  organization_id is not null and public.pfss_has_org_role(organization_id,array['owner','admin'])
);
drop policy if exists pfss_audit_insert_member on public.pfss_audit_log;
create policy pfss_audit_insert_member on public.pfss_audit_log
for insert to authenticated with check (
  actor_id=auth.uid() and organization_id is not null
  and public.pfss_has_org_role(organization_id)
);

commit;
