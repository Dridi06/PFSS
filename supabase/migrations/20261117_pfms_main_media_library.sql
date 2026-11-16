-- PFMS personal media library with private Supabase Storage.
-- Uses the existing private pfss-scout-private bucket and UID-first folder rule.
-- Apply only in STAGING after the read-only schema audit.

create table if not exists public.pfms_main_media (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,
  media_type text not null
    check (media_type in ('photo', 'video')),
  file_name text not null
    check (length(pg_catalog.btrim(file_name)) between 1 and 255),
  storage_path text not null unique,
  mime_type text not null
    check (mime_type in (
      'image/jpeg', 'image/png', 'image/webp', 'image/heic',
      'video/mp4', 'video/quicktime', 'video/webm'
    )),
  file_size bigint not null
    check (file_size between 1 and 52428800),
  created_at timestamptz not null default pg_catalog.now(),
  constraint pfms_main_media_type_matches_mime check (
    (media_type = 'photo' and mime_type like 'image/%')
    or (media_type = 'video' and mime_type like 'video/%')
  ),
  constraint pfms_main_media_storage_path_owner check (
    storage_path ~ ('^[0-9a-fA-F-]{36}/main/[^/]+$')
  )
);

create index if not exists pfms_main_media_owner_created_idx
  on public.pfms_main_media(owner_id, created_at desc);

alter table public.pfms_main_media enable row level security;
alter table public.pfms_main_media force row level security;

drop policy if exists pfms_main_media_select_own on public.pfms_main_media;
create policy pfms_main_media_select_own
on public.pfms_main_media
for select to authenticated
using (owner_id = auth.uid());

drop policy if exists pfms_main_media_insert_own on public.pfms_main_media;
create policy pfms_main_media_insert_own
on public.pfms_main_media
for insert to authenticated
with check (
  owner_id = auth.uid()
  and storage_path ~ ('^' || auth.uid()::text || '/main/[^/]+$')
);

drop policy if exists pfms_main_media_delete_own on public.pfms_main_media;
create policy pfms_main_media_delete_own
on public.pfms_main_media
for delete to authenticated
using (
  owner_id = auth.uid()
  and storage_path ~ ('^' || auth.uid()::text || '/main/[^/]+$')
);

revoke all on table public.pfms_main_media from public, anon;
grant select, insert, delete on table public.pfms_main_media to authenticated;

-- The personal media library uses the already provisioned private scout bucket.
-- Do not make the bucket public or change existing Storage RLS policies.
do $$
begin
  if not exists (
    select 1 from storage.buckets where id = 'pfss-scout-private' and public = false
  ) then
    raise exception 'Required private Storage bucket pfss-scout-private is missing or public';
  end if;
end;
$$;

comment on table public.pfms_main_media is
  'Private user-owned photos and videos stored in pfss-scout-private under <user-id>/main/.';
