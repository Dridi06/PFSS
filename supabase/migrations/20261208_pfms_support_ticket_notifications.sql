-- PFMS in-app notifications for support replies and resolutions.
-- Only the support ticket owner receives the notification.
-- The notification record is inserted by a database trigger, never by the browser.

alter table public.pfms_notifications
  drop constraint if exists pfms_notifications_notification_type_check;

alter table public.pfms_notifications
  add constraint pfms_notifications_notification_type_check
  check (notification_type in (
    'team_task_assigned',
    'team_task_completed',
    'support_ticket_replied',
    'support_ticket_resolved'
  ));

alter table public.pfms_notifications
  add column if not exists support_ticket_id uuid
  references public.pfms_support_tickets(id) on delete set null;

create index if not exists pfms_notifications_support_ticket_idx
  on public.pfms_notifications(support_ticket_id)
  where support_ticket_id is not null;

create or replace function public.pfms_notify_support_ticket_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_notification_type text;
  v_title text;
  v_body text;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if new.admin_response is distinct from old.admin_response
     and nullif(pg_catalog.btrim(coalesce(new.admin_response, '')), '') is not null then
    v_notification_type := 'support_ticket_replied';
    v_title := 'Antwort auf deine Supportanfrage';
    v_body := 'PFMS hat auf deine Supportanfrage „' || new.subject || '“ geantwortet.';
  elsif new.status = 'resolved' and old.status is distinct from 'resolved' then
    v_notification_type := 'support_ticket_resolved';
    v_title := 'Supportanfrage abgeschlossen';
    v_body := 'Deine Supportanfrage „' || new.subject || '“ wurde als erledigt markiert.';
  else
    return new;
  end if;

  if new.owner_id is not null and new.owner_id is distinct from v_actor_id then
    insert into public.pfms_notifications (
      recipient_id,
      actor_id,
      notification_type,
      title,
      body,
      support_ticket_id
    ) values (
      new.owner_id,
      v_actor_id,
      v_notification_type,
      v_title,
      pg_catalog.left(v_body, 500),
      new.id
    );
  end if;

  return new;
end;
$$;

revoke all on function public.pfms_notify_support_ticket_changes()
  from public, anon, authenticated;

drop trigger if exists pfms_support_tickets_notify_changes
  on public.pfms_support_tickets;
create trigger pfms_support_tickets_notify_changes
after update of admin_response, status
on public.pfms_support_tickets
for each row execute function public.pfms_notify_support_ticket_changes();

comment on function public.pfms_notify_support_ticket_changes() is
  'Creates a personal in-app notification for the ticket owner when support responds or resolves a ticket.';
