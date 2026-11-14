-- PFMS Scout Workspace integrity hardening
-- Safe additive migration. Review and apply in STAGING only after the schema audit.

create or replace function public.pfss_scout_touch_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

revoke all on function public.pfss_scout_touch_updated_at() from public, anon, authenticated;

drop trigger if exists pfss_scout_players_touch_updated_at on public.pfss_scout_players;
create trigger pfss_scout_players_touch_updated_at
before update on public.pfss_scout_players
for each row execute function public.pfss_scout_touch_updated_at();

drop trigger if exists pfss_scout_reports_touch_updated_at on public.pfss_scout_reports;
create trigger pfss_scout_reports_touch_updated_at
before update on public.pfss_scout_reports
for each row execute function public.pfss_scout_touch_updated_at();

-- Database-level validation complements client-side checks.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.pfss_scout_players'::regclass
      and conname = 'pfss_scout_players_name_not_blank'
  ) then
    alter table public.pfss_scout_players
      add constraint pfss_scout_players_name_not_blank
      check (length(pg_catalog.btrim(name)) between 1 and 80);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.pfss_scout_reports'::regclass
      and conname = 'pfss_scout_reports_rating_range'
  ) then
    alter table public.pfss_scout_reports
      add constraint pfss_scout_reports_rating_range
      check (overall_rating is null or overall_rating between 0 and 4);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.pfss_scout_reports'::regclass
      and conname = 'pfss_scout_reports_scores_object'
  ) then
    alter table public.pfss_scout_reports
      add constraint pfss_scout_reports_scores_object
      check (pg_catalog.jsonb_typeof(scores) = 'object');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.pfss_scout_media'::regclass
      and conname = 'pfss_scout_media_file_size_range'
  ) then
    alter table public.pfss_scout_media
      add constraint pfss_scout_media_file_size_range
      check (file_size is null or file_size between 0 and 52428800);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.pfss_scout_media'::regclass
      and conname = 'pfss_scout_media_file_name_not_blank'
  ) then
    alter table public.pfss_scout_media
      add constraint pfss_scout_media_file_name_not_blank
      check (length(pg_catalog.btrim(file_name)) between 1 and 255);
  end if;
end;
$$;

-- Media metadata must reference an object path within the caller's own folder.
drop policy if exists pfss_scout_media_insert on public.pfss_scout_media;
create policy pfss_scout_media_insert on public.pfss_scout_media
for insert to authenticated
with check (
  owner_id = auth.uid()
  and pg_catalog.split_part(storage_path, '/', 1) = auth.uid()::text
  and storage_path ~ ('^' || auth.uid()::text || '/[^/]+$')
);

-- Existing rows are deliberately not rewritten. The read-only staging audit and
-- a backup must be reviewed before applying this migration to any database.
)
);

-- Existing rows are deliberately not rewritten. The read-only staging audit and
-- a backup must be reviewed before applying this migration to any database.
