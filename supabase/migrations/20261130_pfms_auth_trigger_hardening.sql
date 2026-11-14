-- PFMS authentication trigger hardening.
-- Keep signup behavior unchanged while removing mutable search_path and public execution.

create or replace function public.pfss_sync_signup_username()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_username text;
begin
  requested_username := pg_catalog.btrim(coalesce(new.raw_user_meta_data ->> 'username', ''));

  if requested_username = '' then
    return new;
  end if;

  if requested_username !~ '^[A-Za-z0-9_.-]{3,20}$' then
    raise exception 'Invalid PFSS username';
  end if;

  insert into public.profiles (id, username, role, status)
  values (new.id, requested_username, 'user', 'pending')
  on conflict (id) do update
    set username = excluded.username;

  return new;
end;
$$;

revoke all on function public.pfss_sync_signup_username() from public, anon, authenticated;

create or replace function public.pfms_provision_new_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text;
  v_name text;
  v_org_id uuid;
  v_scout_type text;
begin
  v_type := pg_catalog.lower(coalesce(new.raw_user_meta_data ->> 'registration_type', ''));
  v_name := pg_catalog.btrim(coalesce(new.raw_user_meta_data ->> 'organization_name', ''));

  if v_type in ('club','agency') and pg_catalog.length(v_name) between 2 and 120 then
    insert into public.pfms_organizations(organization_type,name,created_by)
    values (v_type,v_name,new.id)
    returning id into v_org_id;

    insert into public.pfms_memberships(organization_id,user_id,member_role,status,permissions)
    values (
      v_org_id,new.id,'owner','active',
      '{"view_players":true,"create_players":true,"edit_players":true,"delete_players":true,"view_reports":true,"create_reports":true,"manage_members":true}'::jsonb
    ) on conflict (organization_id,user_id) do nothing;
  elsif v_type='scout' then
    v_scout_type := coalesce(nullif(new.raw_user_meta_data ->> 'scout_type',''),'solo_scout');
    insert into public.pfms_scout_profiles(user_id,scout_type,display_name)
    values (new.id,v_scout_type,nullif(pg_catalog.btrim(coalesce(new.raw_user_meta_data ->> 'username','')),''))
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.pfms_provision_new_account() from public, anon, authenticated;
