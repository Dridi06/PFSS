-- PFMS private Scout workspace: enforce existing row-level security policies.
-- Additive hardening only; no rows or policy definitions are changed.
-- Apply in STAGING after the read-only schema audit and verified backup.

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'pfss_scout_players',
    'pfss_scout_reports',
    'pfss_scout_media'
  ]
  loop
    if not exists (
      select 1
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = table_name
        and c.relkind = 'r'
        and c.relrowsecurity
    ) then
      raise exception 'RLS is not enabled for public.%', table_name;
    end if;
  end loop;
end;
$$;

alter table public.pfss_scout_players force row level security;
alter table public.pfss_scout_reports force row level security;
alter table public.pfss_scout_media force row level security;

comment on table public.pfss_scout_players is
  'Private Scout player records; FORCE RLS applies the owner/admin policies to table-owner contexts.';
comment on table public.pfss_scout_reports is
  'Private Scout reports; FORCE RLS applies the owner/admin policies to table-owner contexts.';
comment on table public.pfss_scout_media is
  'Private Scout media metadata; FORCE RLS applies the owner/admin policies to table-owner contexts.';
