-- PFMS DDL event-trigger hardening.
-- New public tables must fail closed if automatic RLS activation fails.
-- The event trigger remains the only invocation path; browser roles receive no EXECUTE.

create or replace function public.rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  command_row record;
  table_name name;
begin
  for command_row in
    select *
    from pg_catalog.pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table', 'partitioned table')
  loop
    if command_row.schema_name = 'public' then
      select relation.relname
        into table_name
      from pg_catalog.pg_class relation
      where relation.oid = command_row.objid
        and relation.relkind in ('r', 'p');

      if table_name is null then
        raise exception
          'PFMS RLS guard could not resolve newly created public relation: %',
          command_row.object_identity
          using errcode = '55000';
      end if;

      execute pg_catalog.format(
        'ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
        command_row.schema_name,
        table_name
      );

      raise log 'PFMS RLS guard enabled row level security on %',
        command_row.object_identity;
    end if;
  end loop;
end;
$$;

-- Event triggers execute their function through PostgreSQL's event-trigger
-- machinery. Browser API roles must not receive direct function EXECUTE.
revoke all on function public.rls_auto_enable()
  from public, anon, authenticated;

comment on function public.rls_auto_enable() is
  'SECURITY DEFINER DDL event-trigger function. Enables RLS on newly created public tables and aborts the DDL transaction if the relation cannot be resolved or RLS cannot be enabled. Direct browser-role EXECUTE is revoked.';
