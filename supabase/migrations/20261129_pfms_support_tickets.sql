-- PFMS internal support inbox with owner-scoped tickets and administrator-only handling.
create table if not exists public.pfms_support_tickets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,
  subject text not null
    check (length(pg_catalog.btrim(subject)) between 4 and 160),
  category text not null default 'other'
    check (category in ('account','organization','scouting','technical','billing','other')),
  message text not null
    check (length(pg_catalog.btrim(message)) between 10 and 5000),
  status text not null default 'open'
    check (status in ('open','in_progress','resolved')),
  admin_response text
    check (admin_response is null or length(admin_response) <= 5000),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  constraint pfms_support_ticket_resolution_check check (
    (status = 'resolved' and resolved_at is not null)
    or (status <> 'resolved' and resolved_at is null)
  )
);

create index if not exists pfms_support_tickets_owner_created_idx
  on public.pfms_support_tickets(owner_id, created_at desc);
create index if not exists pfms_support_tickets_status_created_idx
  on public.pfms_support_tickets(status, created_at desc);

create or replace function public.pfms_touch_support_ticket()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  if new.status = 'resolved' and old.status <> 'resolved' then
    new.resolved_at := pg_catalog.now();
    new.resolved_by := auth.uid();
  elsif new.status <> 'resolved' then
    new.resolved_at := null;
    new.resolved_by := null;
  end if;
  return new;
end;
$$;

revoke all on function public.pfms_touch_support_ticket() from public, anon, authenticated;
drop trigger if exists pfms_support_tickets_touch_updated_at on public.pfms_support_tickets;
create trigger pfms_support_tickets_touch_updated_at
before update on public.pfms_support_tickets
for each row execute function public.pfms_touch_support_ticket();

alter table public.pfms_support_tickets enable row level security;
alter table public.pfms_support_tickets force row level security;

drop policy if exists pfms_support_tickets_select_own_or_admin on public.pfms_support_tickets;
create policy pfms_support_tickets_select_own_or_admin
on public.pfms_support_tickets
for select to authenticated
using (
  (owner_id = auth.uid() and public.pfms_current_user_is_approved())
  or public.pfms_is_admin()
);

drop policy if exists pfms_support_tickets_insert_own on public.pfms_support_tickets;
create policy pfms_support_tickets_insert_own
on public.pfms_support_tickets
for insert to authenticated
with check (
  owner_id = auth.uid()
  and status = 'open'
  and admin_response is null
  and resolved_at is null
  and resolved_by is null
  and public.pfms_current_user_is_approved()
);

drop policy if exists pfms_support_tickets_update_admin on public.pfms_support_tickets;
create policy pfms_support_tickets_update_admin
on public.pfms_support_tickets
for update to authenticated
using (public.pfms_is_admin())
with check (public.pfms_is_admin());

revoke all on table public.pfms_support_tickets from public, anon;
grant select, insert on public.pfms_support_tickets to authenticated;
grant update (status, admin_response) on public.pfms_support_tickets to authenticated;

comment on table public.pfms_support_tickets is
  'Private support tickets. Submitters see only their own tickets; administrators may review and respond.';
