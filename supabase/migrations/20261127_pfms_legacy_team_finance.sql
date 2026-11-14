-- PFMS team cashbox: immutable income/expense ledger with soft voiding.
-- Access is controlled by the existing finance.view / finance.edit permissions.
-- No direct client writes or physical deletes are granted.

create table if not exists public.pfms_legacy_team_finance_entries (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null
    references public.pfms_legacy_teams(id) on delete cascade,
  transaction_date date not null,
  entry_type text not null
    check (entry_type in ('income','expense')),
  category text not null
    check (category in (
      'membership','team_contribution','donation','tournament',
      'equipment','travel','facility','referee','other'
    )),
  description text not null,
  amount numeric(12,2) not null
    check (amount > 0 and amount <= 1000000),
  currency text not null default 'EUR'
    check (currency = 'EUR'),
  external_reference text,
  status text not null default 'posted'
    check (status in ('posted','voided')),
  created_by uuid not null default auth.uid()
    references auth.users(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  voided_by uuid references auth.users(id) on delete restrict,
  voided_at timestamptz,
  void_reason text,
  constraint pfms_legacy_team_finance_description_check
    check (length(pg_catalog.btrim(description)) between 1 and 300),
  constraint pfms_legacy_team_finance_reference_check
    check (external_reference is null or length(external_reference) <= 100),
  constraint pfms_legacy_team_finance_void_check
    check (
      (status = 'posted' and voided_by is null and voided_at is null and void_reason is null)
      or
      (status = 'voided' and voided_by is not null and voided_at is not null
       and void_reason is not null and length(pg_catalog.btrim(void_reason)) between 1 and 400)
    )
);

create index if not exists pfms_legacy_team_finance_date_idx
  on public.pfms_legacy_team_finance_entries (team_id, transaction_date desc, created_at desc);
create index if not exists pfms_legacy_team_finance_status_idx
  on public.pfms_legacy_team_finance_entries (team_id, status, entry_type);

alter table public.pfms_legacy_team_finance_entries enable row level security;
alter table public.pfms_legacy_team_finance_entries force row level security;

drop policy if exists pfms_legacy_team_finance_select on public.pfms_legacy_team_finance_entries;
create policy pfms_legacy_team_finance_select
on public.pfms_legacy_team_finance_entries
for select to authenticated
using (public.pfms_has_legacy_team_permission(team_id, 'finance', 'view'));

revoke all on table public.pfms_legacy_team_finance_entries from public, anon, authenticated;
grant select on table public.pfms_legacy_team_finance_entries to authenticated;

create or replace function public.pfms_list_legacy_team_finance(p_team_id uuid)
returns table (
  entry_id uuid,
  transaction_date date,
  entry_type text,
  category text,
  description text,
  amount numeric,
  currency text,
  external_reference text,
  entry_status text,
  created_by uuid,
  created_at timestamptz,
  voided_by uuid,
  voided_at timestamptz,
  void_reason text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_team_id is null
     or not public.pfms_has_legacy_team_permission(p_team_id, 'finance', 'view') then
    raise exception 'Not authorized to view team finance' using errcode = '42501';
  end if;

  return query
  select e.id, e.transaction_date, e.entry_type, e.category, e.description,
         e.amount, e.currency, e.external_reference, e.status,
         e.created_by, e.created_at, e.voided_by, e.voided_at, e.void_reason
  from public.pfms_legacy_team_finance_entries e
  where e.team_id = p_team_id
  order by e.transaction_date desc, e.created_at desc
  limit 200;
end;
$$;

create or replace function public.pfms_get_legacy_team_finance_summary(p_team_id uuid)
returns table (
  total_income numeric,
  total_expenses numeric,
  current_balance numeric,
  posted_entries bigint,
  voided_entries bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_team_id is null
     or not public.pfms_has_legacy_team_permission(p_team_id, 'finance', 'view') then
    raise exception 'Not authorized to view team finance summary' using errcode = '42501';
  end if;

  return query
  select
    coalesce(sum(e.amount) filter (where e.status = 'posted' and e.entry_type = 'income'), 0)::numeric,
    coalesce(sum(e.amount) filter (where e.status = 'posted' and e.entry_type = 'expense'), 0)::numeric,
    (coalesce(sum(e.amount) filter (where e.status = 'posted' and e.entry_type = 'income'), 0)
      - coalesce(sum(e.amount) filter (where e.status = 'posted' and e.entry_type = 'expense'), 0))::numeric,
    count(*) filter (where e.status = 'posted'),
    count(*) filter (where e.status = 'voided')
  from public.pfms_legacy_team_finance_entries e
  where e.team_id = p_team_id;
end;
$$;

create or replace function public.pfms_create_legacy_team_finance_entry(
  p_team_id uuid,
  p_transaction_date date,
  p_entry_type text,
  p_category text,
  p_description text,
  p_amount numeric,
  p_external_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry_id uuid;
begin
  if p_team_id is null
     or not public.pfms_has_legacy_team_permission(p_team_id, 'finance', 'edit') then
    raise exception 'Not authorized to create team finance entries' using errcode = '42501';
  end if;

  if p_transaction_date is null
     or p_entry_type is null or p_entry_type not in ('income','expense')
     or p_category is null or p_category not in (
       'membership','team_contribution','donation','tournament',
       'equipment','travel','facility','referee','other'
     )
     or p_description is null
     or pg_catalog.length(pg_catalog.btrim(p_description)) not between 1 and 300
     or p_amount is null or p_amount <= 0 or p_amount > 1000000
     or p_amount <> pg_catalog.round(p_amount, 2)
     or (p_external_reference is not null and pg_catalog.length(p_external_reference) > 100) then
    raise exception 'Invalid team finance entry data' using errcode = '22023';
  end if;

  insert into public.pfms_legacy_team_finance_entries (
    team_id, transaction_date, entry_type, category,
    description, amount, external_reference, created_by
  ) values (
    p_team_id, p_transaction_date, p_entry_type, p_category,
    pg_catalog.btrim(p_description), p_amount,
    nullif(pg_catalog.btrim(coalesce(p_external_reference,'')), ''),
    auth.uid()
  )
  returning id into v_entry_id;

  return v_entry_id;
end;
$$;

create or replace function public.pfms_void_legacy_team_finance_entry(
  p_entry_id uuid,
  p_void_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
  v_status text;
begin
  select team_id, status into v_team_id, v_status
  from public.pfms_legacy_team_finance_entries
  where id = p_entry_id
  for update;

  if not found then
    raise exception 'Finance entry not found' using errcode = 'P0002';
  end if;
  if not public.pfms_has_legacy_team_permission(v_team_id, 'finance', 'edit') then
    raise exception 'Not authorized to void this finance entry' using errcode = '42501';
  end if;
  if v_status <> 'posted' then
    raise exception 'Only posted finance entries can be voided' using errcode = '22023';
  end if;
  if p_void_reason is null
     or pg_catalog.length(pg_catalog.btrim(p_void_reason)) not between 1 and 400 then
    raise exception 'A void reason is required' using errcode = '22023';
  end if;

  update public.pfms_legacy_team_finance_entries
  set status = 'voided',
      voided_by = auth.uid(),
      voided_at = pg_catalog.now(),
      void_reason = pg_catalog.btrim(p_void_reason)
  where id = p_entry_id;
end;
$$;

revoke all on function public.pfms_list_legacy_team_finance(uuid) from public, anon;
revoke all on function public.pfms_get_legacy_team_finance_summary(uuid) from public, anon;
revoke all on function public.pfms_create_legacy_team_finance_entry(uuid,date,text,text,text,numeric,text) from public, anon;
revoke all on function public.pfms_void_legacy_team_finance_entry(uuid,text) from public, anon;

grant execute on function public.pfms_list_legacy_team_finance(uuid) to authenticated;
grant execute on function public.pfms_get_legacy_team_finance_summary(uuid) to authenticated;
grant execute on function public.pfms_create_legacy_team_finance_entry(uuid,date,text,text,text,numeric,text) to authenticated;
grant execute on function public.pfms_void_legacy_team_finance_entry(uuid,text) to authenticated;

comment on table public.pfms_legacy_team_finance_entries is
  'Team-scoped EUR income/expense ledger. Original bookings are retained; invalid records are voided with reason rather than deleted.';
