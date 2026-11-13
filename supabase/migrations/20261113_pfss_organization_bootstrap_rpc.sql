-- PFSS organization bootstrap RPC
-- Completes the safe first-organization creation path for authenticated users.
-- Apply only after 20261113_pfss_core_tenant_foundation.sql in PFSS-Test.

begin;

create or replace function public.pfss_create_organization(
  p_name text,
  p_organization_type text,
  p_slug text default null
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_name is null or length(trim(p_name)) < 2 or length(trim(p_name)) > 160 then
    raise exception 'Invalid organization name' using errcode = '22023';
  end if;

  if p_organization_type not in ('club','agency','academy','scouting_network','other') then
    raise exception 'Invalid organization type' using errcode = '22023';
  end if;

  insert into public.pfss_organizations(name,organization_type,slug,created_by)
  values (trim(p_name),p_organization_type,nullif(lower(trim(p_slug)),''),
          v_user_id)
  returning id into v_organization_id;

  insert into public.pfss_memberships(organization_id,user_id,role,status)
  values (v_organization_id,v_user_id,'owner','active');

  return v_organization_id;
end;
$$;

revoke all on function public.pfss_create_organization(text,text,text)
  from public,anon;
grant execute on function public.pfss_create_organization(text,text,text)
  to authenticated;

comment on function public.pfss_create_organization(text,text,text) is
  'Creates a PFSS tenant and assigns the authenticated creator as its initial owner in one transaction.';

commit;
