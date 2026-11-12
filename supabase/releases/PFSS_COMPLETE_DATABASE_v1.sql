-- PFSS COMPLETE DATABASE FOUNDATION v1.0
-- Additive Supabase migration. No existing tables or rows are dropped.
-- Preserves profiles and legacy organizations/memberships.
-- Requires public.pfms_organizations and public.pfms_memberships.
-- Review/test on a development project before production execution.

begin;
create extension if not exists pgcrypto;

do $$
begin
 if to_regclass('public.profiles') is null then raise exception 'Missing public.profiles'; end if;
 if to_regclass('public.pfms_organizations') is null or to_regclass('public.pfms_memberships') is null then
  raise exception 'Missing PFMS organization foundation; apply/review existing PFMS migration first';
 end if;
end $$;

-- SECURITY HELPERS
create or replace function public.pfss_is_admin()
returns boolean language sql stable security definer set search_path=''
as $$
 select exists(select 1 from public.profiles p where p.id=auth.uid()
 and lower(coalesce(p.role::text,'')) in ('admin','administrator')
 and lower(coalesce(p.status::text,''))='approved');
$$;
create or replace function public.pfss_is_org_member(p_org uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select exists(select 1 from public.pfms_memberships m
 join public.pfms_organizations o on o.id=m.organization_id
 where m.organization_id=p_org and m.user_id=auth.uid()
 and m.status='active' and o.status='active');
$$;
create or replace function public.pfss_has_org_permission(p_org uuid,p_permission text)
returns boolean language sql stable security definer set search_path=''
as $$
 select public.pfss_is_admin() or exists(select 1 from public.pfms_memberships m
 join public.pfms_organizations o on o.id=m.organization_id
 where m.organization_id=p_org and m.user_id=auth.uid()
 and m.status='active' and o.status='active'
 and (m.member_role in ('owner','admin') or coalesce((m.permissions->>p_permission)::boolean,false)));
$$;
create or replace function public.pfss_touch_updated_at()
returns trigger language plpgsql set search_path=''
as $$ begin new.updated_at:=pg_catalog.now(); return new; end; $$;
revoke all on function public.pfss_is_admin() from public,anon;
revoke all on function public.pfss_is_org_member(uuid) from public,anon;
revoke all on function public.pfss_has_org_permission(uuid,text) from public,anon;
grant execute on function public.pfss_is_admin() to authenticated;
grant execute on function public.pfss_is_org_member(uuid) to authenticated;
grant execute on function public.pfss_has_org_permission(uuid,text) to authenticated;

-- CLUBS / TEAMS / STAFF
create table if not exists public.pfss_organization_settings(
 organization_id uuid primary key references public.pfms_organizations(id) on delete cascade,
 legal_name text,country_code char(2),website text,phone text,contact_email text,
 logo_path text,timezone text not null default 'Europe/Berlin',
 settings jsonb not null default '{}'::jsonb,created_at timestamptz not null default now(),
 updated_at timestamptz not null default now());
create table if not exists public.pfss_teams(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.pfms_organizations(id) on delete cascade,
 name text not null,team_type text not null default 'squad'
 check(team_type in ('senior','youth','women','academy','squad','other')),
 age_group text,season text,gender text,status text not null default 'active'
 check(status in ('active','archived')),
 created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(organization_id,name,season));
create table if not exists public.pfss_team_staff(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.pfms_organizations(id) on delete cascade,
 team_id uuid not null references public.pfss_teams(id) on delete cascade,
 user_id uuid references auth.users(id) on delete set null,full_name text not null,
 staff_role text not null check(staff_role in ('head_coach','assistant_coach','goalkeeping_coach','fitness_coach','analyst','manager','other')),
 email text,phone text,created_at timestamptz not null default now(),updated_at timestamptz not null default now());

-- PLAYER MASTER DATA / TEAM HISTORY
create table if not exists public.pfss_players(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.pfms_organizations(id) on delete cascade,
 first_name text not null,last_name text not null,date_of_birth date,
 nationality text,second_nationality text,primary_position text,
 secondary_positions text[] not null default '{}',
 preferred_foot text check(preferred_foot is null or preferred_foot in ('left','right','both')),
 height_cm smallint check(height_cm is null or height_cm between 100 and 230),
 weight_kg numeric(5,2) check(weight_kg is null or weight_kg between 25 and 200),
 current_club text,shirt_number smallint check(shirt_number is null or shirt_number between 0 and 99),
 photo_path text,profile_visibility text not null default 'organization'
 check(profile_visibility in ('private','organization')),
 created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index if not exists pfss_players_org_name_idx on public.pfss_players(organization_id,lower(last_name),lower(first_name));
create index if not exists pfss_players_birth_idx on public.pfss_players(organization_id,date_of_birth);
create index if not exists pfss_players_position_idx on public.pfss_players(organization_id,primary_position);
create table if not exists public.pfss_player_team_history(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.pfms_organizations(id) on delete cascade,
 player_id uuid not null references public.pfss_players(id) on delete cascade,
 team_id uuid references public.pfss_teams(id) on delete set null,
 club_name text,shirt_number smallint,valid_from date,valid_until date,
 is_current boolean not null default false,notes text,created_at timestamptz not null default now(),
 check(valid_until is null or valid_from is null or valid_until>=valid_from));

-- SCOUTING REPORTS / SHORTLISTS
create table if not exists public.pfss_scouting_reports(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.pfms_organizations(id) on delete cascade,
 player_id uuid not null references public.pfss_players(id) on delete cascade,
 scout_user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
 observation_date date not null default current_date,match_context text,opponent text,competition text,
 minutes_observed smallint check(minutes_observed is null or minutes_observed between 0 and 150),
 overall_rating numeric(4,1) check(overall_rating is null or overall_rating between 0 and 10),
 potential_rating numeric(4,1) check(potential_rating is null or potential_rating between 0 and 10),
 technical_score numeric(4,1) check(technical_score is null or technical_score between 0 and 10),
 tactical_score numeric(4,1) check(tactical_score is null or tactical_score between 0 and 10),
 physical_score numeric(4,1) check(physical_score is null or physical_score between 0 and 10),
 mental_score numeric(4,1) check(mental_score is null or mental_score between 0 and 10),
 strengths text,development_areas text,
 recommendation text check(recommendation is null or recommendation in ('follow','monitor','trial','sign','reject')),
 report_status text not null default 'draft' check(report_status in ('draft','submitted','reviewed','archived')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index if not exists pfss_reports_player_idx on public.pfss_scouting_reports(organization_id,player_id,observation_date desc);
create table if not exists public.pfss_shortlists(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.pfms_organizations(id) on delete cascade,
 name text not null,description text,created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
 visibility text not null default 'organization' check(visibility in ('private','organization')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.pfss_shortlist_players(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.pfms_organizations(id) on delete cascade,
 shortlist_id uuid not null references public.pfss_shortlists(id) on delete cascade,
 player_id uuid not null references public.pfss_players(id) on delete cascade,
 priority smallint not null default 3 check(priority between 1 and 5),
 status text not null default 'watching' check(status in ('watching','contacted','trial','signed','rejected')),
 notes text,added_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),unique(shortlist_id,player_id));

-- AGENCY CRM / TRANSFER PIPELINE / CONTRACTS
create table if not exists public.pfss_contacts(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.pfms_organizations(id) on delete cascade,
 contact_type text not null check(contact_type in ('club','agent','player','coach','parent','other')),
 display_name text not null,company text,email text,phone text,country_code char(2),notes text,
 created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.pfss_transfer_cases(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.pfms_organizations(id) on delete cascade,
 player_id uuid references public.pfss_players(id) on delete set null,
 contact_id uuid references public.pfss_contacts(id) on delete set null,title text not null,
 transfer_type text not null default 'permanent' check(transfer_type in ('permanent','loan','free_transfer','trial','representation')),
 pipeline_stage text not null default 'identified' check(pipeline_stage in ('identified','contacted','negotiation','offer','medical','contract','completed','lost','on_hold')),
 source_club text,target_club text,estimated_fee numeric(14,2) check(estimated_fee is null or estimated_fee>=0),
 currency char(3) not null default 'EUR',probability smallint check(probability is null or probability between 0 and 100),
 expected_close_date date,responsible_user_id uuid default auth.uid() references auth.users(id) on delete set null,
 notes text,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.pfss_contracts(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.pfms_organizations(id) on delete cascade,
 player_id uuid references public.pfss_players(id) on delete set null,
 contact_id uuid references public.pfss_contacts(id) on delete set null,
 contract_type text not null check(contract_type in ('player','representation','employment','loan','other')),
 counterparty text,start_date date,end_date date,notice_deadline date,
 status text not null default 'draft' check(status in ('draft','active','expired','terminated','renewed')),
 document_path text,confidential_notes text,
 created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(end_date is null or start_date is null or end_date>=start_date));

-- TASKS / CALENDAR / NOTIFICATIONS
create table if not exists public.pfss_tasks(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.pfms_organizations(id) on delete cascade,
 title text not null,description text,task_type text not null default 'general'
 check(task_type in ('scouting','player_followup','transfer','contract','meeting','general')),
 status text not null default 'open' check(status in ('open','in_progress','done','cancelled')),
 priority text not null default 'normal' check(priority in ('low','normal','high','urgent')),
 assigned_to uuid references auth.users(id) on delete set null,due_at timestamptz,
 related_player_id uuid references public.pfss_players(id) on delete set null,
 related_transfer_id uuid references public.pfss_transfer_cases(id) on delete set null,
 created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.pfss_calendar_events(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.pfms_organizations(id) on delete cascade,
 title text not null,description text,event_type text not null default 'other'
 check(event_type in ('match','training','scouting','meeting','deadline','travel','other')),
 starts_at timestamptz not null,ends_at timestamptz,all_day boolean not null default false,
 location text,team_id uuid references public.pfss_teams(id) on delete set null,
 player_id uuid references public.pfss_players(id) on delete set null,
 created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(ends_at is null or ends_at>=starts_at));
create table if not exists public.pfss_notifications(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid references public.pfms_organizations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 title text not null,body text,notification_type text not null default 'info',
 target_path text,read_at timestamptz,created_at timestamptz not null default now());
create index if not exists pfss_tasks_due_idx on public.pfss_tasks(organization_id,status,due_at);
create index if not exists pfss_events_start_idx on public.pfss_calendar_events(organization_id,starts_at);
create index if not exists pfss_notifications_unread_idx on public.pfss_notifications(user_id,created_at desc) where read_at is null;

-- MEDIA / AUDIT
create table if not exists public.pfss_media(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.pfms_organizations(id) on delete cascade,
 player_id uuid references public.pfss_players(id) on delete cascade,
 report_id uuid references public.pfss_scouting_reports(id) on delete cascade,
 media_type text not null check(media_type in ('photo','video','document')),
 storage_path text not null unique,file_name text not null,mime_type text,
 file_size bigint check(file_size is null or file_size>=0),
 uploaded_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
 created_at timestamptz not null default now());
create table if not exists public.pfss_audit_events(
 id bigint generated always as identity primary key,
 organization_id uuid references public.pfms_organizations(id) on delete set null,
 actor_user_id uuid references auth.users(id) on delete set null,
 action text not null,entity_type text not null,entity_id uuid,
 metadata jsonb not null default '{}'::jsonb,created_at timestamptz not null default now());
create index if not exists pfss_audit_recent_idx on public.pfss_audit_events(organization_id,created_at desc);

-- AUTOMATIC UPDATED_AT
do $$
declare t text;
begin
 foreach t in array array['pfss_organization_settings','pfss_teams','pfss_team_staff','pfss_players',
 'pfss_scouting_reports','pfss_shortlists','pfss_contacts','pfss_transfer_cases','pfss_contracts',
 'pfss_tasks','pfss_calendar_events']
 loop
  execute format('drop trigger if exists %I on public.%I',t||'_touch_updated_at',t);
  execute format('create trigger %I before update on public.%I for each row execute function public.pfss_touch_updated_at()',t||'_touch_updated_at',t);
 end loop;
end $$;

-- ROW LEVEL SECURITY
alter table public.pfss_organization_settings enable row level security;
alter table public.pfss_teams enable row level security;
alter table public.pfss_team_staff enable row level security;
alter table public.pfss_players enable row level security;
alter table public.pfss_player_team_history enable row level security;
alter table public.pfss_scouting_reports enable row level security;
alter table public.pfss_shortlists enable row level security;
alter table public.pfss_shortlist_players enable row level security;
alter table public.pfss_contacts enable row level security;
alter table public.pfss_transfer_cases enable row level security;
alter table public.pfss_contracts enable row level security;
alter table public.pfss_tasks enable row level security;
alter table public.pfss_calendar_events enable row level security;
alter table public.pfss_notifications enable row level security;
alter table public.pfss_media enable row level security;
alter table public.pfss_audit_events enable row level security;

-- All organization-domain tables are scoped to active members. The permissions
-- model currently uses create_players/edit_players/delete_players for writes.
do $$
declare t text;
begin
 foreach t in array array['pfss_organization_settings','pfss_teams','pfss_team_staff','pfss_players',
 'pfss_player_team_history','pfss_scouting_reports','pfss_shortlists','pfss_shortlist_players',
 'pfss_contacts','pfss_transfer_cases','pfss_contracts','pfss_tasks','pfss_calendar_events','pfss_media']
 loop
  execute format('drop policy if exists %I on public.%I',t||'_select',t);
  execute format('create policy %I on public.%I for select to authenticated using (public.pfss_is_org_member(organization_id) or public.pfss_is_admin())',t||'_select',t);
  execute format('drop policy if exists %I on public.%I',t||'_insert',t);
  execute format('create policy %I on public.%I for insert to authenticated with check (public.pfss_has_org_permission(organization_id,''create_players''))',t||'_insert',t);
  execute format('drop policy if exists %I on public.%I',t||'_update',t);
  execute format('create policy %I on public.%I for update to authenticated using (public.pfss_has_org_permission(organization_id,''edit_players'')) with check (public.pfss_has_org_permission(organization_id,''edit_players''))',t||'_update',t);
  execute format('drop policy if exists %I on public.%I',t||'_delete',t);
  execute format('create policy %I on public.%I for delete to authenticated using (public.pfss_has_org_permission(organization_id,''delete_players''))',t||'_delete',t);
 end loop;
end $$;

-- Notifications belong to one user. Audit records are append-only.
drop policy if exists pfss_notifications_select on public.pfss_notifications;
create policy pfss_notifications_select on public.pfss_notifications for select to authenticated
 using(user_id=auth.uid() or public.pfss_is_admin());
drop policy if exists pfss_notifications_insert on public.pfss_notifications;
create policy pfss_notifications_insert on public.pfss_notifications for insert to authenticated
 with check(public.pfss_is_admin() or (user_id=auth.uid() and (organization_id is null or public.pfss_is_org_member(organization_id))));
drop policy if exists pfss_notifications_update on public.pfss_notifications;
create policy pfss_notifications_update on public.pfss_notifications for update to authenticated
 using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists pfss_notifications_delete on public.pfss_notifications;
create policy pfss_notifications_delete on public.pfss_notifications for delete to authenticated using(user_id=auth.uid());
drop policy if exists pfss_audit_events_select on public.pfss_audit_events;
create policy pfss_audit_events_select on public.pfss_audit_events for select to authenticated
 using(public.pfss_is_admin() or public.pfss_has_org_permission(organization_id,'manage_members'));
drop policy if exists pfss_audit_events_insert on public.pfss_audit_events;
create policy pfss_audit_events_insert on public.pfss_audit_events for insert to authenticated
 with check(actor_user_id=auth.uid() and (organization_id is null or public.pfss_is_org_member(organization_id)));
-- No UPDATE or DELETE policy on audit events.

grant select,insert,update,delete on public.pfss_organization_settings,public.pfss_teams,
 public.pfss_team_staff,public.pfss_players,public.pfss_player_team_history,
 public.pfss_scouting_reports,public.pfss_shortlists,public.pfss_shortlist_players,
 public.pfss_contacts,public.pfss_transfer_cases,public.pfss_contracts,public.pfss_tasks,
 public.pfss_calendar_events,public.pfss_notifications,public.pfss_media to authenticated;
grant select,insert on public.pfss_audit_events to authenticated;
grant usage,select on sequence public.pfss_audit_events_id_seq to authenticated;

-- PRIVATE STORAGE. First object-path folder is the organization UUID.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('pfss-org-private','pfss-org-private',false,52428800,
 array['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/quicktime','video/webm','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=52428800,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists pfss_org_storage_select on storage.objects;
create policy pfss_org_storage_select on storage.objects for select to authenticated
 using(bucket_id='pfss-org-private' and public.pfss_is_org_member(((storage.foldername(name))[1])::uuid));
drop policy if exists pfss_org_storage_insert on storage.objects;
create policy pfss_org_storage_insert on storage.objects for insert to authenticated
 with check(bucket_id='pfss-org-private' and public.pfss_has_org_permission(((storage.foldername(name))[1])::uuid,'create_players'));
drop policy if exists pfss_org_storage_update on storage.objects;
create policy pfss_org_storage_update on storage.objects for update to authenticated
 using(bucket_id='pfss-org-private' and public.pfss_has_org_permission(((storage.foldername(name))[1])::uuid,'edit_players'))
 with check(bucket_id='pfss-org-private' and public.pfss_has_org_permission(((storage.foldername(name))[1])::uuid,'edit_players'));
drop policy if exists pfss_org_storage_delete on storage.objects;
create policy pfss_org_storage_delete on storage.objects for delete to authenticated
 using(bucket_id='pfss-org-private' and public.pfss_has_org_permission(((storage.foldername(name))[1])::uuid,'delete_players'));

commit;

-- VERIFY:
-- select tablename,rowsecurity from pg_tables where schemaname='public' and tablename like 'pfss_%' order by tablename;
-- select tablename,policyname,cmd from pg_policies where schemaname='public' and tablename like 'pfss_%' order by tablename,policyname;
-- NOTE: This creates DB objects only. Existing localStorage/mockup frontend code
-- must be explicitly connected to these tables. Never expose service-role keys.
-- This does not replace the existing private scout-workspace migration.
