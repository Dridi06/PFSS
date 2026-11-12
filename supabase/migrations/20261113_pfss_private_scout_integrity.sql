-- PFSS private scout workspace: relational integrity follow-up.
-- Depends on 20261112_private_scout_workspaces.sql.
-- Additive and data-preserving; no rows are rewritten or removed.
-- Apply first to a separate Supabase development project.
-- This migration does NOT replace the still-open organization RBAC design.

begin;

do $$
begin
  if to_regclass('public.pfss_scout_players') is null
     or to_regclass('public.pfss_scout_reports') is null
     or to_regclass('public.pfss_scout_media') is null then
    raise exception
      'PFSS private scout tables are missing; apply and verify 20261112_private_scout_workspaces.sql first.';
  end if;
end
$$;

-- The composite key makes ownership part of the relationship itself.
create unique index if not exists pfss_scout_players_owner_id_id_uidx
  on public.pfss_scout_players(owner_id, id);

-- Reports must reference a player owned by the same scout, even if a future
-- policy is accidentally loosened.
alter table public.pfss_scout_reports
  drop constraint if exists pfss_scout_reports_player_id_fkey;
alter table public.pfss_scout_reports
  drop constraint if exists pfss_scout_reports_owner_player_fkey;
alter table public.pfss_scout_reports
  add constraint pfss_scout_reports_owner_player_fkey
  foreign key (owner_id, player_id)
  references public.pfss_scout_players(owner_id, id)
  on delete cascade;

-- Media may be unassigned, but a linked player must belong to the same owner.
alter table public.pfss_scout_media
  drop constraint if exists pfss_scout_media_player_id_fkey;
alter table public.pfss_scout_media
  drop constraint if exists pfss_scout_media_owner_player_fkey;
alter table public.pfss_scout_media
  add constraint pfss_scout_media_owner_player_fkey
  foreign key (owner_id, player_id)
  references public.pfss_scout_players(owner_id, id)
  on delete set null (player_id);

-- New/updated media metadata must store objects beneath the authenticated
-- owner's folder. NOT VALID avoids rejecting any legacy rows during rollout;
-- PostgreSQL still enforces this CHECK for every new or modified row.
alter table public.pfss_scout_media
  drop constraint if exists pfss_scout_media_owner_path_check;
alter table public.pfss_scout_media
  add constraint pfss_scout_media_owner_path_check
  check (storage_path like owner_id::text || '/%') not valid;

-- Keep update timestamps reliable even when a client omits updated_at.
create or replace function public.pfss_set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

revoke all on function public.pfss_set_updated_at() from public, anon, authenticated;

drop trigger if exists pfss_scout_players_set_updated_at
  on public.pfss_scout_players;
create trigger pfss_scout_players_set_updated_at
before update on public.pfss_scout_players
for each row execute function public.pfss_set_updated_at();

drop trigger if exists pfss_scout_reports_set_updated_at
  on public.pfss_scout_reports;
create trigger pfss_scout_reports_set_updated_at
before update on public.pfss_scout_reports
for each row execute function public.pfss_set_updated_at();

-- Supporting indexes for owner-scoped lookups and the new composite references.
create index if not exists pfss_scout_reports_owner_player_idx
  on public.pfss_scout_reports(owner_id, player_id);
create index if not exists pfss_scout_media_owner_player_idx
  on public.pfss_scout_media(owner_id, player_id);

commit;
