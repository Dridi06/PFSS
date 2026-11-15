-- PFMS staging schema baseline inventory.
-- READ ONLY: use this output to reconcile the live staging schema with the
-- repository migration history before any migration is applied or repaired.
with inventory as (
  select
    'PROJECT'::text as section,
    current_database()::text as object_name,
    jsonb_build_object(
      'server_version', current_setting('server_version'),
      'current_user', current_user,
      'migration_ledger', to_regclass('supabase_migrations.schema_migrations')::text,
      'public_relation_count', (
        select count(*) from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r','p','v','m','f')
      )
    ) as details

  union all

  select
    'RELATION',
    n.nspname || '.' || c.relname,
    jsonb_build_object(
      'kind', c.relkind,
      'owner', pg_catalog.pg_get_userbyid(c.relowner),
      'rls_enabled', c.relrowsecurity,
      'rls_forced', c.relforcerowsecurity,
      'estimated_rows', c.reltuples::bigint,
      'comment', pg_catalog.obj_description(c.oid, 'pg_class')
    )
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public','storage')
    and c.relkind in ('r','p','v','m','f')

  union all

  select
    'COLUMN',
    n.nspname || '.' || c.relname || '.' || a.attname,
    jsonb_build_object(
      'ordinal', a.attnum,
      'type', pg_catalog.format_type(a.atttypid, a.atttypmod),
      'not_null', a.attnotnull,
      'default', pg_catalog.pg_get_expr(d.adbin, d.adrelid),
      'identity', a.attidentity,
      'generated', a.attgenerated
    )
  from pg_catalog.pg_attribute a
  join pg_catalog.pg_class c on c.oid = a.attrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  left join pg_catalog.pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
  where n.nspname in ('public','storage')
    and c.relkind in ('r','p')
    and a.attnum > 0
    and not a.attisdropped

  union all

  select
    'CONSTRAINT',
    n.nspname || '.' || c.relname || '.' || con.conname,
    jsonb_build_object(
      'type', con.contype,
      'definition', pg_catalog.pg_get_constraintdef(con.oid, true),
      'validated', con.convalidated,
      'deferrable', con.condeferrable,
      'initially_deferred', con.condeferred
    )
  from pg_catalog.pg_constraint con
  join pg_catalog.pg_class c on c.oid = con.conrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public','storage')

  union all

  select
    'INDEX',
    n.nspname || '.' || c.relname || '.' || irel.relname,
    jsonb_build_object(
      'definition', pg_catalog.pg_get_indexdef(i.oid),
      'valid', i.indisvalid,
      'ready', i.indisready,
      'unique', i.indisunique,
      'primary', i.indisprimary
    )
  from pg_catalog.pg_index i
  join pg_catalog.pg_class c on c.oid = i.indrelid
  join pg_catalog.pg_class irel on irel.oid = i.indexrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public','storage')

  union all

  select
    'POLICY',
    n.nspname || '.' || c.relname || '.' || p.polname,
    jsonb_build_object(
      'command', p.polcmd,
      'permissive', p.polpermissive,
      'roles', p.polroles::regrole[],
      'using', pg_catalog.pg_get_expr(p.polqual, p.polrelid),
      'with_check', pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid)
    )
  from pg_catalog.pg_policy p
  join pg_catalog.pg_class c on c.oid = p.polrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public','storage')

  union all

  select
    'TRIGGER',
    n.nspname || '.' || c.relname || '.' || t.tgname,
    jsonb_build_object(
      'enabled', t.tgenabled,
      'definition', pg_catalog.pg_get_triggerdef(t.oid, true),
      'function', t.tgfoid::regprocedure::text
    )
  from pg_catalog.pg_trigger t
  join pg_catalog.pg_class c on c.oid = t.tgrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public','storage','auth')
    and not t.tgisinternal

  union all

  select
    'FUNCTION',
    n.nspname || '.' || p.oid::regprocedure::text,
    jsonb_build_object(
      'language', l.lanname,
      'owner', pg_catalog.pg_get_userbyid(p.proowner),
      'security_definer', p.prosecdef,
      'volatility', p.provolatile,
      'settings', p.proconfig,
      'acl', p.proacl,
      'definition', pg_catalog.pg_get_functiondef(p.oid)
    )
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  join pg_catalog.pg_language l on l.oid = p.prolang
  where n.nspname in ('public','auth')
    and p.prokind in ('f','p')

  union all

  select
    'TABLE_PRIVILEGE',
    table_schema || '.' || table_name || '.' || grantee,
    jsonb_build_object(
      'privilege', privilege_type,
      'is_grantable', is_grantable
    )
  from information_schema.role_table_grants
  where table_schema in ('public','storage')
)
select section, object_name, details
from inventory
order by section, object_name;
