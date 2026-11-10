-- PFSS DATABASE AUDIT (READ ONLY)
-- Run in Supabase SQL Editor. This script does not change any data or schema.

-- 1) Existing columns for the PFSS application tables
select
  table_name,
  ordinal_position,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('players', 'scouting_reports', 'profiles', 'audit_log', 'rechte')
order by table_name, ordinal_position;

-- 2) Row Level Security status for those tables
select
  schemaname,
  tablename,
  rowsecurity as rls_enabled
from pg_tables
where schemaname = 'public'
  and tablename in ('players', 'scouting_reports', 'profiles', 'audit_log', 'rechte')
order by tablename;

-- 3) Existing policies (who can read/write which rows)
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('players', 'scouting_reports', 'profiles', 'audit_log', 'rechte')
order by tablename, policyname;
