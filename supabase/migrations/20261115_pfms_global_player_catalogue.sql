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
