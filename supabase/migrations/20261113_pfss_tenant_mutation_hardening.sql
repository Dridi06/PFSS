-- PFSS tenant mutation hardening
-- Follow-up to 20261113_pfss_core_tenant_foundation.sql.
-- Prevent client-side membership role escalation. Membership changes must go
-- through narrowly scoped SECURITY DEFINER RPCs or trusted server functions.
-- Apply only in isolated PFSS-Test after the core foundation migration.

begin;

-- A user may edit only profile presentation fields, never account status or identity.
revoke update on public.profiles from authenticated;
grant update (username, display_name) on public.profiles to authenticated;

-- Membership reads remain available to active organization members.
-- All membership mutations are server-controlled until invitation/role RPCs
-- have been implemented and security-tested.
revoke insert, update, delete on public.pfss_memberships from authenticated;

drop policy if exists pfss_memberships_insert_admin on public.pfss_memberships;
drop policy if exists pfss_memberships_update_admin on public.pfss_memberships;
drop policy if exists pfss_memberships_delete_owner on public.pfss_memberships;

-- Invitations are also server-controlled: direct writes could forge or alter
-- token lifecycle data, so only organization owners/admins may read them.
revoke insert, update on public.pfss_invitations from authenticated;
drop policy if exists pfss_invitations_insert_admin on public.pfss_invitations;
drop policy if exists pfss_invitations_update_admin on public.pfss_invitations;

commit;
