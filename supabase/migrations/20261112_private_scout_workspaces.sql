-- PFSS isolated scout workspaces
-- Each scout owns a private player database, reports and media.
-- Administrators retain oversight. No legacy tables are modified.

create table if not exists public.pfss_scout_players (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pfss_scout_players_foot_check check (foot is null or foot in ('Rechts','Links','Beidfüßig'))
);

create index if not exists pfss_scout_players_owner_idx on public.pfss_scout_players(owner_id);
create index if not exists pfss_scout_players_surname_idx on public.pfss_scout_players(owner_id, lower(coalesce(surname,'')));

create table if not exists public.pfss_scout_reports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  player_id uuid not null references public.pfss_scout_players(id) on delete cascade,
  observation_date date not null default current_date,
  overall_rating numeric(3,1),
  scores jsonb not null default '{}'::jsonb,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pfss_scout_reports_owner_idx on public.pfss_scout_reports(owner_id);
create index if not exists pfss_scout_reports_player_idx on public.pfss_scout_reports(player_id);

create table if not exists public.pfss_scout_media (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  player_id uuid references public.pfss_scout_players(id) on delete set null,
  media_type text not null check (media_type in ('photo','video')),
  file_name text not null,
  storage_path text not null unique,
  mime_type text,
  file_size bigint,
  created_at timestamptz not null default now()
);

create index if not exists pfss_scout_media_owner_idx on public.pfss_scout_media(owner_id);

alter table public.pfss_scout_players enable row level security;
alter table public.pfss_scout_reports enable row level security;
alter table public.pfss_scout_media enable row level security;

drop policy if exists pfss_scout_players_select on public.pfss_scout_players;
create policy pfss_scout_players_select on public.pfss_scout_players
for select to authenticated using (owner_id = auth.uid() or public.is_admin());

drop policy if exists pfss_scout_players_insert on public.pfss_scout_players;
create policy pfss_scout_players_insert on public.pfss_scout_players
for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists pfss_scout_players_update on public.pfss_scout_players;
create policy pfss_scout_players_update on public.pfss_scout_players
for update to authenticated using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists pfss_scout_players_delete on public.pfss_scout_players;
create policy pfss_scout_players_delete on public.pfss_scout_players
for delete to authenticated using (owner_id = auth.uid() or public.is_admin());

drop policy if exists pfss_scout_reports_select on public.pfss_scout_reports;
create policy pfss_scout_reports_select on public.pfss_scout_reports
for select to authenticated using (owner_id = auth.uid() or public.is_admin());

drop policy if exists pfss_scout_reports_insert on public.pfss_scout_reports;
create policy pfss_scout_reports_insert on public.pfss_scout_reports
for insert to authenticated
with check (
  owner_id = auth.uid()
  and exists (select 1 from public.pfss_scout_players p where p.id = player_id and p.owner_id = auth.uid())
);

drop policy if exists pfss_scout_reports_update on public.pfss_scout_reports;
create policy pfss_scout_reports_update on public.pfss_scout_reports
for update to authenticated
using (owner_id = auth.uid() or public.is_admin())
with check (
  owner_id = auth.uid()
  and exists (select 1 from public.pfss_scout_players p where p.id = player_id and p.owner_id = auth.uid())
  or public.is_admin()
);

drop policy if exists pfss_scout_reports_delete on public.pfss_scout_reports;
create policy pfss_scout_reports_delete on public.pfss_scout_reports
for delete to authenticated using (owner_id = auth.uid() or public.is_admin());

drop policy if exists pfss_scout_media_select on public.pfss_scout_media;
create policy pfss_scout_media_select on public.pfss_scout_media
for select to authenticated using (owner_id = auth.uid() or public.is_admin());

drop policy if exists pfss_scout_media_insert on public.pfss_scout_media;
create policy pfss_scout_media_insert on public.pfss_scout_media
for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists pfss_scout_media_delete on public.pfss_scout_media;
create policy pfss_scout_media_delete on public.pfss_scout_media
for delete to authenticated using (owner_id = auth.uid() or public.is_admin());

grant select, insert, update, delete on public.pfss_scout_players to authenticated;
grant select, insert, update, delete on public.pfss_scout_reports to authenticated;
grant select, insert, delete on public.pfss_scout_media to authenticated;

-- Private bucket; every object is stored under <auth.uid()>/<filename>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pfss-scout-private','pfss-scout-private',false,52428800,
  array['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/quicktime','video/webm'])
on conflict (id) do update set public=false, file_size_limit=52428800,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists pfss_scout_storage_select on storage.objects;
create policy pfss_scout_storage_select on storage.objects
for select to authenticated using (
  bucket_id='pfss-scout-private'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists pfss_scout_storage_insert on storage.objects;
create policy pfss_scout_storage_insert on storage.objects
for insert to authenticated with check (
  bucket_id='pfss-scout-private'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists pfss_scout_storage_delete on storage.objects;
create policy pfss_scout_storage_delete on storage.objects
for delete to authenticated using (
  bucket_id='pfss-scout-private'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
);
