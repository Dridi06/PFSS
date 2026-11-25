-- Additive scouting intelligence data layer. Raw video is never uploaded here; only tagged events.
create table if not exists public.asi_video_event_tags (
  id uuid primary key default gen_random_uuid(),
  player_id bigint not null references public.players(player_id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  match_date date,
  competition text,
  opponent text,
  minute numeric(5,2) not null check (minute between 0 and 150),
  event_type text not null check (event_type in ('pass','progressive_pass','key_pass','shot','goal','assist','dribble','tackle','interception','duel','press','recovery','turnover','cross','carry','positioning','other')),
  zone text,
  outcome text,
  source_url text,
  verification_status text not null default 'pending' check (verification_status in ('pending','verified','rejected')),
  notes text,
  created_at timestamptz not null default now(),
  constraint asi_video_event_source_https check (source_url is null or source_url ~ '^https://')
);
create index if not exists asi_video_event_player_date_idx on public.asi_video_event_tags(player_id,match_date desc,minute);
create index if not exists asi_video_event_owner_created_idx on public.asi_video_event_tags(owner_id,created_at desc);
alter table public.asi_video_event_tags enable row level security;
create policy asi_video_event_owner_read on public.asi_video_event_tags for select to authenticated
 using(owner_id=(select auth.uid()) or (select private.is_admin()));
create policy asi_video_event_owner_insert_pending on public.asi_video_event_tags for insert to authenticated
 with check(owner_id=(select auth.uid()) and created_by=(select auth.uid()) and verification_status='pending');
create policy asi_video_event_admin_all on public.asi_video_event_tags for all to authenticated
 using((select private.is_admin())) with check((select private.is_admin()));
grant select,insert,update on public.asi_video_event_tags to authenticated;

create table if not exists public.asi_scout_calibration_records (
  id uuid primary key default gen_random_uuid(),
  player_id bigint not null references public.players(player_id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  scout_id uuid not null references auth.users(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  scout_rating numeric(5,2) not null check(scout_rating between 0 and 100),
  outcome_metric text not null,
  verified_outcome numeric(5,2) check(verified_outcome is null or verified_outcome between 0 and 100),
  outcome_observed_on date,
  outcome_source_url text,
  verification_status text not null default 'pending' check(verification_status in ('pending','verified','rejected')),
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  review_reason text,
  created_at timestamptz not null default now(),
  constraint asi_scout_calibration_source_https check(outcome_source_url is null or outcome_source_url ~ '^https://'),
  constraint asi_scout_calibration_verified_fields check(
    (verification_status <> 'verified') or
    (verified_outcome is not null and outcome_observed_on is not null and outcome_source_url is not null and verified_by is not null and verified_at is not null)
  )
);
create index if not exists asi_scout_calibration_owner_idx on public.asi_scout_calibration_records(owner_id,created_at desc);
create index if not exists asi_scout_calibration_scout_idx on public.asi_scout_calibration_records(scout_id,verification_status);
alter table public.asi_scout_calibration_records enable row level security;
create policy asi_scout_calibration_owner_read on public.asi_scout_calibration_records for select to authenticated
 using(owner_id=(select auth.uid()) or (select private.is_admin()));
create policy asi_scout_calibration_owner_insert_pending on public.asi_scout_calibration_records for insert to authenticated
 with check(owner_id=(select auth.uid()) and created_by=(select auth.uid()) and scout_id=(select auth.uid()) and verification_status='pending' and verified_outcome is null and verified_by is null and verified_at is null);
create policy asi_scout_calibration_admin_all on public.asi_scout_calibration_records for all to authenticated
 using((select private.is_admin())) with check((select private.is_admin()));
grant select,insert,update on public.asi_scout_calibration_records to authenticated;

create table if not exists public.asi_scout_calibration_audit (
 id uuid primary key default gen_random_uuid(),
 record_id uuid not null references public.asi_scout_calibration_records(id) on delete cascade,
 reviewer_id uuid not null references auth.users(id) on delete restrict,
 decision text not null check(decision in ('verify','reject')),
 reason text not null check(length(trim(reason))>=10),
 previous_state jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
alter table public.asi_scout_calibration_audit enable row level security;
create policy asi_scout_calibration_audit_admin_read on public.asi_scout_calibration_audit for select to authenticated using((select private.is_admin()));
create policy asi_scout_calibration_audit_admin_insert on public.asi_scout_calibration_audit for insert to authenticated with check((select private.is_admin()) and reviewer_id=(select auth.uid()));
grant select,insert on public.asi_scout_calibration_audit to authenticated;

create or replace function public.asi_review_scout_calibration(
 p_record_id uuid,p_decision text,p_reason text,p_verified_outcome numeric default null,
 p_observed_on date default null,p_source_url text default null
) returns jsonb
language plpgsql security invoker
set search_path=pg_catalog,public,private
as $$
declare v_actor uuid:=auth.uid(); v_row public.asi_scout_calibration_records%rowtype;
begin
 if v_actor is null or not private.is_admin() then raise exception 'admin_required' using errcode='42501'; end if;
 if p_decision not in ('verify','reject') or length(trim(coalesce(p_reason,'')))<10 then raise exception 'invalid_review' using errcode='22023'; end if;
 if p_decision='verify' and (p_verified_outcome is null or p_verified_outcome not between 0 and 100 or p_observed_on is null or p_source_url !~ '^https://') then raise exception 'verified_outcome_requires_value_date_https_source' using errcode='22023'; end if;
 select * into v_row from public.asi_scout_calibration_records where id=p_record_id for update;
 if not found then raise exception 'calibration_record_not_found' using errcode='P0002'; end if;
 if v_row.verification_status<>'pending' then raise exception 'calibration_record_already_reviewed' using errcode='55000'; end if;
 insert into public.asi_scout_calibration_audit(record_id,reviewer_id,decision,reason,previous_state)
 values(v_row.id,v_actor,p_decision,trim(p_reason),jsonb_build_object('verification_status',v_row.verification_status,'verified_outcome',v_row.verified_outcome));
 update public.asi_scout_calibration_records set
  verification_status=case when p_decision='verify' then 'verified' else 'rejected' end,
  verified_outcome=case when p_decision='verify' then p_verified_outcome else null end,
  outcome_observed_on=case when p_decision='verify' then p_observed_on else null end,
  outcome_source_url=case when p_decision='verify' then p_source_url else null end,
  verified_by=v_actor,verified_at=now(),review_reason=trim(p_reason)
 where id=v_row.id;
 return jsonb_build_object('record_id',v_row.id,'decision',p_decision,'reviewed_by',v_actor);
end;
$$;
revoke all on function public.asi_review_scout_calibration(uuid,text,text,numeric,date,text) from public,anon;
grant execute on function public.asi_review_scout_calibration(uuid,text,text,numeric,date,text) to authenticated;
