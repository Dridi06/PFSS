-- PFSS private organization media storage and audit-log hardening.
-- Apply after core tenant foundation and RPC migrations in PFSS-Test.

begin;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values (
  'pfss-tenant-private',
  'pfss-tenant-private',
  false,
  104857600,
  array[
    'image/jpeg','image/png','image/webp',
    'video/mp4','video/quicktime','video/webm',
    'application/pdf'
  ]
)
on conflict (id) do update
set public=false,
    file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists pfss_tenant_media_read on storage.objects;
create policy pfss_tenant_media_read
on storage.objects for select to authenticated
using (
  bucket_id='pfss-tenant-private'
  and name ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/[^/].*$'
  and public.pfss_has_org_role(split_part(name,'/',1)::uuid)
);

drop policy if exists pfss_tenant_media_insert on storage.objects;
create policy pfss_tenant_media_insert
on storage.objects for insert to authenticated
with check (
  bucket_id='pfss-tenant-private'
  and name ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/[^/].*$'
  and split_part(name,'/',2)::uuid=auth.uid()
  and public.pfss_has_org_role(
    split_part(name,'/',1)::uuid,
    array['owner','admin','scout','analyst']
  )
);

drop policy if exists pfss_tenant_media_delete on storage.objects;
create policy pfss_tenant_media_delete
on storage.objects for delete to authenticated
using (
  bucket_id='pfss-tenant-private'
  and name ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/[^/].*$'
  and (
    split_part(name,'/',2)::uuid=auth.uid()
    or public.pfss_has_org_role(split_part(name,'/',1)::uuid,array['owner','admin'])
  )
);

-- Audit records are written only by trusted server-side code. The browser may
-- read organization audit history through its existing SELECT policy.
revoke insert, update, delete on public.pfss_audit_log from authenticated;

commit;
