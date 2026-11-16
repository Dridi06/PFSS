-- PFMS compatibility bridge for legacy organization administration RPCs.
-- Earlier legacy management functions call public.is_admin(). In the tracked
-- migration history, the canonical helper is public.pfms_is_admin().
-- Keep the legacy RPC names working without maintaining two role definitions.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.pfms_is_admin();
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

comment on function public.is_admin() is
  'Backward-compatible legacy admin check delegating to PFMS approved administrator authorization.';
