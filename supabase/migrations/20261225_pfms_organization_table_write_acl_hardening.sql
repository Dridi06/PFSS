-- Keep tenant-owned organization tables read-only to browser roles.
-- All writes must flow through the SECURITY DEFINER RPCs or trusted server-side
-- provisioning. RLS remains the row-level boundary for authenticated reads.

revoke all privileges on table
  public.pfms_organizations,
  public.pfms_memberships,
  public.pfms_scout_profiles
from public, anon, authenticated;

grant select on table
  public.pfms_organizations,
  public.pfms_memberships,
  public.pfms_scout_profiles
to authenticated;

grant all privileges on table
  public.pfms_organizations,
  public.pfms_memberships,
  public.pfms_scout_profiles
to service_role;

comment on table public.pfms_organizations is
  'Organization tenant records. Browser roles have read-only table privileges; mutations use protected RPCs.';
comment on table public.pfms_memberships is
  'Organization membership records. Browser roles have read-only table privileges; mutations use protected RPCs.';
comment on table public.pfms_scout_profiles is
  'Personal scout workspace records. Browser roles have read-only table privileges; mutations use protected RPCs.';
