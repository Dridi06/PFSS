-- PFMS team tactical and video analysis.
-- Team-scoped analysis records; browser writes are RPC-only and require analysis.edit.
-- Video files stay at their existing provider/storage; only HTTPS references and timestamps are stored.

create unique index if not exists pfms_legacy_team_matches_id_team_uidx
  on public.pfms_legacy_team_matches (id, team_id);

create table if not exists public.pfms_legacy_team_analysis (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null
    references public.pfms_legacy_teams(id) on delete cascade,
  match_id uuid,
  title text not null,
  analysis_type text not null
    check (analysis_type in ('tactical','video')),
  phase text not null default 'general'
    check (phase in (
      'pre_match','build_up','pressing','transition',
      'defending','set_piece','individual','general'
    )),
  observation_date date not null default current_date,
  video_url text,
  video_timestamp_seconds integer,
  summary text not null,
  strengths text,
  improvements text,
  action_items text,
  status text not null default 'draft'
    check (status in ('draft','reviewed','archived')),
  created_by uuid not null default auth.uid()
    references auth.users(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint pfms_legacy_team_analysis_title_check
    check (length(pg_catalog.btrim(title)) between 3 and 140),
  constraint pfms_legacy_team_analysis_summary_check
    check (length(pg_catalog.btrim(summary)) between 1 and 10000),
  constraint pfms_legacy_team_analysis_strengths_check
    check (strengths is null or length(strengths) <= 3000),
  constraint pfms_legacy_team_analysis_improvements_check
    check (improvements is null or length(improvements) <= 3000),
  constraint pfms_legacy_team_analysis_actions_check
    check (action_items is null or length(action_items) <= 3000),
  constraint pfms_legacy_team_analysis_video_url_check
    check (
      video_url is null
      or (
        length(video_url) <= 1000
        and video_url ~ '^https://[[:alnum:]]([[:alnum:].-]*[[:alnum:]])?(:[0-9]{1,5})?([/?#][^[:space:]]*)?$'
      )
    ),
  constraint pfms_legacy_team_analysis_video_required_check
    check (analysis_type <> 'video' or video_url is not null),
  constraint pfms_legacy_team_analysis_timestamp_check
    check (
      video_timestamp_seconds is null
      or (
        video_url is not null
        and video_timestamp_seconds between 0 and 86400
      )
    ),
  constraint pfms_legacy_team_analysis_match_team_fk
    foreign key (match_id, team_id)
    references public.pfms_legacy_team_matches(id, team_id)
    on delete set null (match_id)
);

create index if not exists pfms_legacy_team_analysis_team_date_idx
  on public.pfms_legacy_team_analysis(team_id, observation_date desc, created_at desc);
create index if not exists pfms_legacy_team_analysis_match_idx
  on public.pfms_legacy_team_analysis(match_id)
  where match_id is not null;

create or replace function public.pfms_touch_legacy_team_analysis()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

revoke all on function public.pfms_touch_legacy_team_analysis()
  from public, anon, authenticated;

drop trigger if exists pfms_legacy_team_analysis_touch_updated_at
  on public.pfms_legacy_team_analysis;
create trigger pfms_legacy_team_analysis_touch_updated_at
before update on public.pfms_legacy_team_analysis
for each row execute function public.pfms_touch_legacy_team_analysis();

alter table public.pfms_legacy_team_analysis enable row level security;
alter table public.pfms_legacy_team_analysis force row level security;

drop policy if exists pfms_legacy_team_analysis_select on public.pfms_legacy_team_analysis;
create policy pfms_legacy_team_analysis_select
on public.pfms_legacy_team_analysis
for select to authenticated
using (public.pfms_has_legacy_team_permission(team_id, 'analysis', 'view'));

revoke all on table public.pfms_legacy_team_analysis from public, anon, authenticated;
grant select on table public.pfms_legacy_team_analysis to authenticated;

create or replace function public.pfms_list_legacy_team_analysis_matches(
  p_team_id uuid
)
returns table (
  match_id uuid,
  opponent text,
  competition text,
  match_date date,
  home_away text,
  match_status text,
  team_goals smallint,
  opponent_goals smallint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_team_id is null
     or not public.pfms_has_legacy_team_permission(p_team_id, 'analysis', 'view') then
    raise exception 'Not authorized to view analysis match references'
      using errcode = '42501';
  end if;

  return query
  select m.id, m.opponent, m.competition, m.match_date, m.home_away,
         m.status, m.team_goals, m.opponent_goals
  from public.pfms_legacy_team_matches m
  where m.team_id = p_team_id
  order by m.match_date desc, m.kickoff desc;
end;
$$;

create or replace function public.pfms_list_legacy_team_analysis(
  p_team_id uuid
)
returns table (
  analysis_id uuid,
  match_id uuid,
  match_opponent text,
  match_date date,
  analysis_title text,
  analysis_type text,
  phase text,
  observation_date date,
  video_url text,
  video_timestamp_seconds integer,
  summary text,
  strengths text,
  improvements text,
  action_items text,
  analysis_status text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_team_id is null
     or not public.pfms_has_legacy_team_permission(p_team_id, 'analysis', 'view') then
    raise exception 'Not authorized to view team analysis' using errcode = '42501';
  end if;

  return query
  select a.id, a.match_id, m.opponent, m.match_date,
         a.title, a.analysis_type, a.phase, a.observation_date,
         a.video_url, a.video_timestamp_seconds, a.summary,
         a.strengths, a.improvements, a.action_items, a.status,
         a.created_at, a.updated_at
  from public.pfms_legacy_team_analysis a
  left join public.pfms_legacy_team_matches m
    on m.id = a.match_id
   and m.team_id = a.team_id
  where a.team_id = p_team_id
  order by a.observation_date desc, a.created_at desc;
end;
$$;

create or replace function public.pfms_create_legacy_team_analysis(
  p_team_id uuid,
  p_title text,
  p_analysis_type text,
  p_phase text,
  p_observation_date date,
  p_summary text,
  p_status text default 'draft',
  p_match_id uuid default null,
  p_video_url text default null,
  p_video_timestamp_seconds integer default null,
  p_strengths text default null,
  p_improvements text default null,
  p_action_items text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_analysis_id uuid;
  v_match_id uuid;
begin
  if p_team_id is null
     or not public.pfms_has_legacy_team_permission(p_team_id, 'analysis', 'edit') then
    raise exception 'Not authorized to create team analysis' using errcode = '42501';
  end if;

  if p_match_id is not null then
    select m.id into v_match_id
    from public.pfms_legacy_team_matches m
    where m.id = p_match_id
      and m.team_id = p_team_id
    for share;
    if not found then
      raise exception 'Selected match does not belong to this team'
        using errcode = '23514';
    end if;
  end if;

  if p_title is null
     or pg_catalog.length(pg_catalog.btrim(p_title)) not between 3 and 140
     or p_analysis_type is null or p_analysis_type not in ('tactical','video')
     or p_phase is null or p_phase not in (
       'pre_match','build_up','pressing','transition',
       'defending','set_piece','individual','general'
     )
     or p_observation_date is null
     or p_summary is null
     or pg_catalog.length(pg_catalog.btrim(p_summary)) not between 1 and 10000
     or p_status is null or p_status not in ('draft','reviewed','archived')
     or (p_video_url is not null and (
       pg_catalog.length(p_video_url) > 1000
       or p_video_url !~ '^https://[[:alnum:]]([[:alnum:].-]*[[:alnum:]])?(:[0-9]{1,5})?([/?#][^[:space:]]*)?$'
     ))
     or (p_analysis_type = 'video' and p_video_url is null)
     or (p_video_timestamp_seconds is not null and (
       p_video_url is null or p_video_timestamp_seconds not between 0 and 86400
     ))
     or (p_strengths is not null and pg_catalog.length(p_strengths) > 3000)
     or (p_improvements is not null and pg_catalog.length(p_improvements) > 3000)
     or (p_action_items is not null and pg_catalog.length(p_action_items) > 3000) then
    raise exception 'Invalid tactical/video analysis data' using errcode = '22023';
  end if;

  insert into public.pfms_legacy_team_analysis (
    team_id, match_id, title, analysis_type, phase, observation_date,
    video_url, video_timestamp_seconds, summary, strengths,
    improvements, action_items, status, created_by
  ) values (
    p_team_id, v_match_id, pg_catalog.btrim(p_title), p_analysis_type,
    p_phase, p_observation_date, nullif(pg_catalog.btrim(coalesce(p_video_url, '')), ''),
    p_video_timestamp_seconds, pg_catalog.btrim(p_summary),
    nullif(pg_catalog.btrim(coalesce(p_strengths, '')), ''),
    nullif(pg_catalog.btrim(coalesce(p_improvements, '')), ''),
    nullif(pg_catalog.btrim(coalesce(p_action_items, '')), ''),
    p_status, auth.uid()
  )
  returning id into v_analysis_id;

  return v_analysis_id;
end;
$$;

create or replace function public.pfms_update_legacy_team_analysis(
  p_analysis_id uuid,
  p_title text,
  p_analysis_type text,
  p_phase text,
  p_observation_date date,
  p_summary text,
  p_status text,
  p_match_id uuid default null,
  p_video_url text default null,
  p_video_timestamp_seconds integer default null,
  p_strengths text default null,
  p_improvements text default null,
  p_action_items text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
  v_match_id uuid;
begin
  select a.team_id into v_team_id
  from public.pfms_legacy_team_analysis a
  where a.id = p_analysis_id
  for update;

  if not found then
    raise exception 'Analysis record not found' using errcode = 'P0002';
  end if;
  if not public.pfms_has_legacy_team_permission(v_team_id, 'analysis', 'edit') then
    raise exception 'Not authorized to update team analysis' using errcode = '42501';
  end if;

  if p_match_id is not null then
    select m.id into v_match_id
    from public.pfms_legacy_team_matches m
    where m.id = p_match_id
      and m.team_id = v_team_id
    for share;
    if not found then
      raise exception 'Selected match does not belong to this team'
        using errcode = '23514';
    end if;
  end if;

  if p_title is null
     or pg_catalog.length(pg_catalog.btrim(p_title)) not between 3 and 140
     or p_analysis_type is null or p_analysis_type not in ('tactical','video')
     or p_phase is null or p_phase not in (
       'pre_match','build_up','pressing','transition',
       'defending','set_piece','individual','general'
     )
     or p_observation_date is null
     or p_summary is null
     or pg_catalog.length(pg_catalog.btrim(p_summary)) not between 1 and 10000
     or p_status is null or p_status not in ('draft','reviewed','archived')
     or (p_video_url is not null and (
       pg_catalog.length(p_video_url) > 1000
       or p_video_url !~ '^https://[[:alnum:]]([[:alnum:].-]*[[:alnum:]])?(:[0-9]{1,5})?([/?#][^[:space:]]*)?$'
     ))
     or (p_analysis_type = 'video' and p_video_url is null)
     or (p_video_timestamp_seconds is not null and (
       p_video_url is null or p_video_timestamp_seconds not between 0 and 86400
     ))
     or (p_strengths is not null and pg_catalog.length(p_strengths) > 3000)
     or (p_improvements is not null and pg_catalog.length(p_improvements) > 3000)
     or (p_action_items is not null and pg_catalog.length(p_action_items) > 3000) then
    raise exception 'Invalid tactical/video analysis data' using errcode = '22023';
  end if;

  update public.pfms_legacy_team_analysis
  set match_id = v_match_id,
      title = pg_catalog.btrim(p_title),
      analysis_type = p_analysis_type,
      phase = p_phase,
      observation_date = p_observation_date,
      video_url = nullif(pg_catalog.btrim(coalesce(p_video_url, '')), ''),
      video_timestamp_seconds = p_video_timestamp_seconds,
      summary = pg_catalog.btrim(p_summary),
      strengths = nullif(pg_catalog.btrim(coalesce(p_strengths, '')), ''),
      improvements = nullif(pg_catalog.btrim(coalesce(p_improvements, '')), ''),
      action_items = nullif(pg_catalog.btrim(coalesce(p_action_items, '')), ''),
      status = p_status,
      updated_at = pg_catalog.now()
  where id = p_analysis_id;
end;
$$;

create or replace function public.pfms_delete_legacy_team_analysis(
  p_analysis_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
begin
  select a.team_id into v_team_id
  from public.pfms_legacy_team_analysis a
  where a.id = p_analysis_id
  for update;

  if not found then
    raise exception 'Analysis record not found' using errcode = 'P0002';
  end if;
  if not public.pfms_has_legacy_team_permission(v_team_id, 'analysis', 'edit') then
    raise exception 'Not authorized to delete team analysis' using errcode = '42501';
  end if;

  delete from public.pfms_legacy_team_analysis
  where id = p_analysis_id;
end;
$$;

revoke all on function public.pfms_list_legacy_team_analysis_matches(uuid) from public, anon;
grant execute on function public.pfms_list_legacy_team_analysis_matches(uuid) to authenticated;
revoke all on function public.pfms_list_legacy_team_analysis(uuid) from public, anon;
grant execute on function public.pfms_list_legacy_team_analysis(uuid) to authenticated;
revoke all on function public.pfms_create_legacy_team_analysis(uuid, text, text, text, date, text, text, uuid, text, integer, text, text, text) from public, anon;
grant execute on function public.pfms_create_legacy_team_analysis(uuid, text, text, text, date, text, uuid, text, integer, text, text, text) to authenticated;
revoke all on function public.pfms_update_legacy_team_analysis(uuid, text, text, text, date, text, text, uuid, text, integer, text, text, text) from public, anon;
grant execute on function public.pfms_update_legacy_team_analysis(uuid, text, text, text, date, text, text, uuid, text, integer, text, text, text) to authenticated;
revoke all on function public.pfms_delete_legacy_team_analysis(uuid) from public, anon;
grant execute on function public.pfms_delete_legacy_team_analysis(uuid) to authenticated;

comment on table public.pfms_legacy_team_analysis is
  'Team-owned tactical and video analysis. Only users with the granular analysis module permission can read or change records.';
