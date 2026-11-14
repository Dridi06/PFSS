-- PFMS personal in-app notifications.
-- Notifications are produced server-side from team-task lifecycle events.
-- Users may read only their own notifications and may only mark them as read.

create table if not exists public.pfms_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  notification_type text not null check (
    notification_type in ('team_task_assigned','team_task_completed')
  ),
  title text not null
    check (length(pg_catalog.btrim(title)) between 1 and 140),
  body text not null
    check (length(pg_catalog.btrim(body)) between 1 and 500),
  team_id uuid references public.pfms_legacy_teams(id) on delete set null,
  task_id uuid references public.pfms_legacy_team_tasks(id) on delete set null,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  constraint pfms_notifications_read_state_check check (
    (is_read and read_at is not null)
    or (not is_read and read_at is null)
  )
);

create index if not exists pfms_notifications_recipient_created_idx
  on public.pfms_notifications(recipient_id, created_at desc);
create index if not exists pfms_notifications_recipient_unread_idx
  on public.pfms_notifications(recipient_id, created_at desc)
  where not is_read;

alter table public.pfms_notifications enable row level security;
alter table public.pfms_notifications force row level security;

drop policy if exists pfms_notifications_select_own on public.pfms_notifications;
create policy pfms_notifications_select_own
on public.pfms_notifications
for select to authenticated
using (recipient_id = auth.uid());

drop policy if exists pfms_notifications_update_own on public.pfms_notifications;
create policy pfms_notifications_update_own
on public.pfms_notifications
for update to authenticated
using (recipient_id = auth.uid())
with check (recipient_id = auth.uid());

revoke all on table public.pfms_notifications from public, anon, authenticated;
grant select on table public.pfms_notifications to authenticated;
grant update (is_read) on table public.pfms_notifications to authenticated;

create or replace function public.pfms_touch_notification_read_state()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.is_read then
    new.read_at := coalesce(old.read_at, pg_catalog.now());
  else
    new.read_at := null;
  end if;
  return new;
end;
$$;

revoke all on function public.pfms_touch_notification_read_state()
  from public, anon, authenticated;

drop trigger if exists pfms_notifications_touch_read_state
  on public.pfms_notifications;
create trigger pfms_notifications_touch_read_state
before update of is_read on public.pfms_notifications
for each row execute function public.pfms_touch_notification_read_state();

create or replace function public.pfms_notify_legacy_team_task_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_recipient_id uuid;
begin
  if tg_op = 'INSERT' then
    if new.assigned_to is not null
       and new.assigned_to is distinct from v_actor_id then
      insert into public.pfms_notifications (
        recipient_id, actor_id, notification_type, title, body, team_id, task_id
      ) values (
        new.assigned_to,
        v_actor_id,
        'team_task_assigned',
        'Neue Teamaufgabe',
        'Dir wurde die Aufgabe „' || new.title || '“ zugewiesen.',
        new.team_id,
        new.id
      );
    end if;
    return new;
  end if;

  if new.assigned_to is distinct from old.assigned_to
     and new.assigned_to is not null
     and new.assigned_to is distinct from v_actor_id then
    insert into public.pfms_notifications (
      recipient_id, actor_id, notification_type, title, body, team_id, task_id
    ) values (
      new.assigned_to,
      v_actor_id,
      'team_task_assigned',
      'Teamaufgabe zugewiesen',
      'Dir wurde die Aufgabe „' || new.title || '“ zugewiesen.',
      new.team_id,
      new.id
    );
  end if;

  if new.status = 'done' and old.status is distinct from 'done' then
    for v_recipient_id in
      select distinct recipients.user_id
      from pg_catalog.unnest(array[new.created_by, new.assigned_to]) as recipients(user_id)
      where recipients.user_id is not null
        and recipients.user_id is distinct from v_actor_id
    loop
      insert into public.pfms_notifications (
        recipient_id, actor_id, notification_type, title, body, team_id, task_id
      ) values (
        v_recipient_id,
        v_actor_id,
        'team_task_completed',
        'Teamaufgabe erledigt',
        'Die Aufgabe „' || new.title || '“ wurde abgeschlossen.',
        new.team_id,
        new.id
      );
    end loop;
  end if;

  return new;
end;
$$;

revoke all on function public.pfms_notify_legacy_team_task_changes()
  from public, anon, authenticated;

drop trigger if exists pfms_legacy_team_tasks_notify_changes
  on public.pfms_legacy_team_tasks;
create trigger pfms_legacy_team_tasks_notify_changes
after insert or update of assigned_to, status
on public.pfms_legacy_team_tasks
for each row execute function public.pfms_notify_legacy_team_task_changes();

comment on table public.pfms_notifications is
  'Per-user in-app notifications. Team task notifications are generated by database triggers; browser roles can only read their own rows and set is_read.';
