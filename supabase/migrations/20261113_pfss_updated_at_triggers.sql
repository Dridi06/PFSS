-- Consistent updated_at maintenance for mutable PFSS tenant records.

begin;

create or replace function public.pfss_set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.pfss_set_updated_at() from public,anon,authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','pfss_organizations','pfss_memberships',
    'pfss_teams','pfss_players','pfss_scouting_reports',
    'pfss_tasks','pfss_calendar_events'
  ] loop
    execute format('drop trigger if exists %I on public.%I',t||'_set_updated_at',t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.pfss_set_updated_at()',
      t||'_set_updated_at',t
    );
  end loop;
end $$;

commit;
