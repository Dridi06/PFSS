-- Harden legacy core authorization helpers and admin RPCs without rewriting
-- historical migrations (which may already exist in a remote migration ledger).
-- ALTER FUNCTION preserves each function body and existing behavior while
-- pinning name resolution to the implicit pg_catalog schema only.

alter function public.pfms_is_admin()
  set search_path = '';
alter function public.pfms_is_org_member(uuid)
  set search_path = '';
alter function public.pfms_admin_search_organizations(text, text)
  set search_path = '';
alter function public.pfms_admin_list_org_members(uuid)
  set search_path = '';
alter function public.pfms_admin_update_membership(uuid, text, text, jsonb)
  set search_path = '';
alter function public.pfms_admin_list_scouts(text)
  set search_path = '';

-- Reassert the intended browser execution boundary for these SECURITY DEFINER RPCs.
revoke all on function public.pfms_is_admin()
  from public, anon;
revoke all on function public.pfms_is_org_member(uuid)
  from public, anon;
revoke all on function public.pfms_admin_search_organizations(text, text)
  from public, anon;
revoke all on function public.pfms_admin_list_org_members(uuid)
  from public, anon;
revoke all on function public.pfms_admin_update_membership(uuid, text, text, jsonb)
  from public, anon;
revoke all on function public.pfms_admin_list_scouts(text)
  from public, anon;

grant execute on function public.pfms_is_admin()
  to authenticated;
grant execute on function public.pfms_is_org_member(uuid)
  to authenticated;
grant execute on function public.pfms_admin_search_organizations(text, text)
  to authenticated;
grant execute on function public.pfms_admin_list_org_members(uuid)
  to authenticated;
grant execute on function public.pfms_admin_update_membership(uuid, text, text, jsonb)
  to authenticated;
grant execute on function public.pfms_admin_list_scouts(text)
  to authenticated;

comment on function public.pfms_is_admin() is
  'Canonical approved-platform-admin predicate; SECURITY DEFINER with empty search_path.';
comment on function public.pfms_is_org_member(uuid) is
  'Current organization membership predicate; SECURITY DEFINER with empty search_path.';
