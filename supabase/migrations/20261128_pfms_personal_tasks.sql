-- PFMS personal task center. Personal tasks are private to the authenticated owner.
create table if not exists public.pfms_personal_tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,
  title text not null
    check (length(pg_catalog.btrim(title)) between 1 and 160),
  description text
    check (description is null or length(description) <= 3000),
  due_date date,
  priority text not null default 'normal'
    check (priority in ('low','normal','high')),
  status text not null default 'open'
    check (status in ('open','in_progress','done')),
  completed_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint pfms_personal_tasks_done_timestamp check (
    (status = 'done' and completed_at is not null)
    or (status <> 'done' and completed_at is null)
  )
);

create index if not exists pfms_personal_tasks_owner_status_due_idx
  on public.pfms_personal_tasks(owner_id, status, due_date);

create or replace function public.pfms_touch_personal_task()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := pg_catalog.now();
  if new.status = 'done' and old.status <> 'done' then
    new.completed_at := pg_catalog.now();
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

revoke all on function public.pfms_touch_personal_task() from public, anon, authenticated;
drop trigger if exists pfms_personal_tasks_touch_updated_at on public.pfms_personal_tasks;
create trigger pfms_personal_tasks_touch_updated_at
before update on public.pfms_personal_tasks
for each row execute function public.pfms_touch_personal_task();

alter table public.pfms_personal_tasks enable row level security;
alter table public.pfms_personal_tasks force row level security;

drop policy if exists pfms_personal_tasks_select_own on public.pfms_personal_tasks;
create policy pfms_personal_tasks_select_own
on public.pfms_personal_tasks
for select to authenticated
using (owner_id = auth.uid() and public.pfms_current_user_is_approved());

drop policy if exists pfms_personal_tasks_insert_own on public.pfms_personal_tasks;
create policy pfms_personal_tasks_insert_own
on public.pfms_personal_tasks
for insert to authenticated
with check (owner_id = auth.uid() and public.pfms_current_user_is_approved());

drop policy if exists pfms_personal_tasks_update_own on public.pfms_personal_tasks;
create policy pfms_personal_tasks_update_own
on public.pfms_personal_tasks
for update to authenticated
using (owner_id = auth.uid() and public.pfms_current_user_is_approved())
with check (owner_id = auth.uid() and public.pfms_current_user_is_approved());

drop policy if exists pfms_personal_tasks_delete_own on public.pfms_personal_tasks;
create policy pfms_personal_tasks_delete_own
on public.pfms_personal_tasks
for delete to authenticated
using (owner_id = auth.uid() and public.pfms_current_user_is_approved());

revoke all on table public.pfms_personal_tasks from public, anon;
grant select, insert, update, delete on public.pfms_personal_tasks to authenticated;

comment on table public.pfms_personal_tasks is
  'Private personal task list. Every task is owned by one approved authenticated PFMS user.';
