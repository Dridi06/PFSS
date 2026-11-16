-- PFSS private scout workspace isolation hardening.
-- Tightens media-to-player ownership and forces RLS on private workspace tables.

alter table public.pfss_scout_players force row level security;
alter table public.pfss_scout_reports force row level security;
alter table public.pfss_scout_media force row level security;

-- A scout may attach media only to a player in that scout's own workspace.
-- Keep the UID-first object path invariant from the earlier integrity migration.
drop policy if exists pfss_scout_media_insert on public.pfss_scout_media;
create policy pfss_scout_media_insert
on public.pfss_scout_media
for insert to authenticated
with check (
  owner_id = auth.uid()
  and pg_catalog.split_part(storage_path, '/', 1) = auth.uid()::text
  and storage_path ~ ('^' || auth.uid()::text || '/[^/]+$')
  and (
    player_id is null
    or exists (
      select 1
      from public.pfss_scout_players p
      where p.id = player_id
        and p.owner_id = auth.uid()
    )
  )
);

-- Keep media metadata aligned with the private bucket's allowlist.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.pfss_scout_media'::regclass
      and conname = 'pfss_scout_media_mime_type_allowlist'
  ) then
    alter table public.pfss_scout_media
      add constraint pfss_scout_media_mime_type_allowlist
      check (
        mime_type is null
        or mime_type in (
          'image/jpeg', 'image/png', 'image/webp', 'image/heic',
          'video/mp4', 'video/quicktime', 'video/webm'
        )
      );
  end if;
end;
$$;

comment on table public.pfss_scout_media is
  'Private scout media metadata; media can reference only a player owned by the same scout.';
