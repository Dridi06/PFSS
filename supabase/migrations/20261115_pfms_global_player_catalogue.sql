-- PFMS global player catalogue and persistent main scouting reports.
-- Additive migration. Apply in STAGING only after the read-only schema audit.

create or replace function public.pfms_current_user_is_approved()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.status, '')) = 'approved'
  );
$$;

revoke all on function public.pfms_current_user_is_approved() from public, anon;
grant execute on function public.pfms_current_user_is_approved() to authenticated;

create table if not exists public.pfms_global_players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  surname text,
  birth date,
  join_date date,
  nationality text,
  position text not null default 'Mittelfeld',
  club text,
  height integer,
  foot text,
  notes text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint pfms_global_players_name_check check (length(pg_catalog.btrim(name)) between 1 and 120),
  constraint pfms_global_players_height_check check (height is null or height between 100 and 230),
  constraint pfms_global_players_foot_check check (foot is null or foot in ('Rechts','Links','Beidfüßig')),
  constraint pfms_global_players_position_check check (position in ('Torwart','Abwehr','Mittelfeld','Sturm'))
);

create index if not exists pfms_global_players_surname_idx
  on public.pfms_global_players (lower(coalesce(surname, name)));
create index if not exists pfms_global_players_birth_idx
  on public.pfms_global_players (birth);
create index if not exists pfms_global_players_club_idx
  on public.pfms_global_players (lower(coalesce(club, '')));

create table if not exists public.pfms_main_scouting_reports (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.pfms_global_players(id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  observation_date date not null default current_date,
  overall_rating numeric(3,1) not null,
  notes text not null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint pfms_main_scouting_reports_rating_check check (overall_rating between 1 and 10),
  constraint pfms_main_scouting_reports_notes_check check (length(pg_catalog.btrim(notes)) between 1 and 10000)
);

create index if not exists pfms_main_scouting_reports_author_idx
  on public.pfms_main_scouting_reports (author_id, observation_date desc);
create index if not exists pfms_main_scouting_reports_player_idx
  on public.pfms_main_scouting_reports (player_id, observation_date desc);

create or replace function public.pfms_touch_main_data()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := pg_catalog.now();
  if tg_table_name = 'pfms_global_players' then
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

revoke all on function public.pfms_touch_main_data() from public, anon, authenticated;

drop trigger if exists pfms_global_players_touch_updated_at on public.pfms_global_players;
create trigger pfms_global_players_touch_updated_at
before update on public.pfms_global_players
for each row execute function public.pfms_touch_main_data();

drop trigger if exists pfms_main_scouting_reports_touch_updated_at on public.pfms_main_scouting_reports;
create trigger pfms_main_scouting_reports_touch_updated_at
before update on public.pfms_main_scouting_reports
for each row execute function public.pfms_touch_main_data();

alter table public.pfms_global_players enable row level security;
alter table public.pfms_main_scouting_reports enable row level security;

drop policy if exists pfms_global_players_select on public.pfms_global_players;
create policy pfms_global_players_select on public.pfms_global_players
for select to authenticated
using (public.pfms_current_user_is_approved());

drop policy if exists pfms_global_players_insert on public.pfms_global_players;
create policy pfms_global_players_insert on public.pfms_global_players
for insert to authenticated
with check (public.pfms_is_admin() and created_by = auth.uid());

drop policy if exists pfms_global_players_update on public.pfms_global_players;
create policy pfms_global_players_update on public.pfms_global_players
for update to authenticated
using (public.pfms_is_admin())
with check (public.pfms_is_admin());

drop policy if exists pfms_global_players_delete on public.pfms_global_players;
create policy pfms_global_players_delete on public.pfms_global_players
for delete to authenticated
using (public.pfms_is_admin());

drop policy if exists pfms_main_scouting_reports_select on public.pfms_main_scouting_reports;
create policy pfms_main_scouting_reports_select on public.pfms_main_scouting_reports
for select to authenticated
using (author_id = auth.uid() or public.pfms_is_admin());

drop policy if exists pfms_main_scouting_reports_insert on public.pfms_main_scouting_reports;
create policy pfms_main_scouting_reports_insert on public.pfms_main_scouting_reports
for insert to authenticated
with check (
  author_id = auth.uid()
  and public.pfms_current_user_is_approved()
  and exists (
    select 1 from public.pfms_global_players p
    where p.id = player_id
  )
);

drop policy if exists pfms_main_scouting_reports_update on public.pfms_main_scouting_reports;
create policy pfms_main_scouting_reports_update on public.pfms_main_scouting_reports
for update to authenticated
using (author_id = auth.uid() or public.pfms_is_admin())
with check (author_id = auth.uid() or public.pfms_is_admin());

drop policy if exists pfms_main_scouting_reports_delete on public.pfms_main_scouting_reports;
create policy pfms_main_scouting_reports_delete on public.pfms_main_scouting_reports
for delete to authenticated
using (author_id = auth.uid() or public.pfms_is_admin());

grant select, insert, update, delete on public.pfms_global_players to authenticated;
grant select, insert, update, delete on public.pfms_main_scouting_reports to authenticated;


-- Controlled, transactional migration of legacy browser backups into the cloud catalogue.
-- Input IDs are remapped; no browser-provided ownership IDs are trusted.
create or replace function public.pfms_import_legacy_catalogue(
  p_players jsonb,
  p_reports jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  player_item jsonb;
  report_item jsonb;
  old_player_id text;
  new_player_id uuid;
  id_map jsonb := '{}'::jsonb;
  player_count integer := 0;
  report_count integer := 0;
  player_name text;
  player_position text;
  player_foot text;
  rating_value numeric;
  report_notes text;
begin
  if not public.pfms_is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  if pg_catalog.jsonb_typeof(p_players) <> 'array'
     or pg_catalog.jsonb_typeof(p_reports) <> 'array' then
    raise exception 'Invalid backup payload' using errcode = '22023';
  end if;

  if pg_catalog.jsonb_array_length(p_players) > 5000
     or pg_catalog.jsonb_array_length(p_reports) > 20000 then
    raise exception 'Backup is too large' using errcode = '22023';
  end if;

  for player_item in
    select value from pg_catalog.jsonb_array_elements(p_players) as rows(value)
  loop
    old_player_id := nullif(player_item ->> 'id', '');
    player_name := pg_catalog.btrim(coalesce(player_item ->> 'name', ''));
    player_position := coalesce(nullif(player_item ->> 'position', ''), 'Mittelfeld');
    player_foot := nullif(player_item ->> 'foot', '');

    if old_player_id is null or id_map ? old_player_id then
      raise exception 'Invalid or duplicate player ID in backup' using errcode = '22023';
    end if;
    if pg_catalog.length(player_name) not between 1 and 120 then
      raise exception 'Invalid player name in backup' using errcode = '22023';
    end if;
    if player_position not in ('Torwart','Abwehr','Mittelfeld','Sturm') then
      raise exception 'Invalid player position in backup' using errcode = '22023';
    end if;
    if player_foot is not null and player_foot not in ('Rechts','Links','Beidfüßig') then
      raise exception 'Invalid player foot in backup' using errcode = '22023';
    end if;

    new_player_id := gen_random_uuid();
    id_map := id_map || pg_catalog.jsonb_build_object(old_player_id, new_player_id::text);

    insert into public.pfms_global_players (
      id, name, surname, birth, join_date, nationality, position,
      club, height, foot, notes, created_by, updated_by
    ) values (
      new_player_id,
      player_name,
      nullif(pg_catalog.btrim(coalesce(player_item ->> 'surname', '')), ''),
      nullif(player_item ->> 'birth', '')::date,
      nullif(player_item ->> 'joinDate', '')::date,
      nullif(pg_catalog.btrim(coalesce(player_item ->> 'nationality', '')), ''),
      player_position,
      nullif(pg_catalog.btrim(coalesce(player_item ->> 'club', '')), ''),
      nullif(player_item ->> 'height', '')::integer,
      player_foot,
      nullif(pg_catalog.btrim(coalesce(player_item ->> 'notes', '')), ''),
      auth.uid(),
      auth.uid()
    );

    player_count := player_count + 1;
  end loop;

  for report_item in
    select value from pg_catalog.jsonb_array_elements(p_reports) as rows(value)
  loop
    old_player_id := nullif(report_item ->> 'playerId', '');
    report_notes := pg_catalog.btrim(coalesce(report_item ->> 'notes', ''));
    rating_value := nullif(report_item ->> 'rating', '')::numeric;

    if old_player_id is null or not (id_map ? old_player_id) then
      raise exception 'A report references a player missing from the backup' using errcode = '22023';
    end if;
    if rating_value is null or rating_value < 1 or rating_value > 10 then
      raise exception 'Invalid scouting rating in backup' using errcode = '22023';
    end if;
    if pg_catalog.length(report_notes) not between 1 and 10000 then
      raise exception 'Invalid report notes in backup' using errcode = '22023';
    end if;

    insert into public.pfms_main_scouting_reports (
      player_id, author_id, observation_date, overall_rating, notes
    ) values (
      (id_map ->> old_player_id)::uuid,
      auth.uid(),
      coalesce(nullif(report_item ->> 'date', '')::date, pg_catalog.current_date),
      rating_value,
      report_notes
    );

    report_count := report_count + 1;
  end loop;

  return pg_catalog.jsonb_build_object(
    'players_imported', player_count,
    'reports_imported', report_count
  );
end;
$$;

revoke all on function public.pfms_import_legacy_catalogue(jsonb, jsonb) from public, anon;
grant execute on function public.pfms_import_legacy_catalogue(jsonb, jsonb) to authenticated;
