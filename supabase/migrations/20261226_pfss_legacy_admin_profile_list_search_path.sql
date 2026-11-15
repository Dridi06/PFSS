-- The unpaginated profile-list RPC is retained for backward compatibility.
-- Its current frontend replacement is paginated, but the legacy endpoint must
-- still be safe if an older authenticated admin client calls it.

alter function public.pfss_admin_list_profiles()
  set search_path = '';

revoke all on function public.pfss_admin_list_profiles()
  from public, anon;

grant execute on function public.pfss_admin_list_profiles()
  to authenticated;

comment on function public.pfss_admin_list_profiles() is
  'Legacy compatibility endpoint; SECURITY DEFINER with empty search_path. New clients use the bounded paginated profile RPC.';
