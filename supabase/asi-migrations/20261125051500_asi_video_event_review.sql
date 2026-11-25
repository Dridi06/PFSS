create table if not exists public.asi_video_event_reviews (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.asi_video_event_tags(id) on delete cascade,
 reviewer_id uuid not null references auth.users(id) on delete restrict,
 decision text not null check(decision in ('verify','reject')),
 reason text not null check(length(trim(reason))>=10),
 previous_state jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists asi_video_event_reviews_event_idx on public.asi_video_event_reviews(event_id);
create index if not exists asi_video_event_reviews_reviewer_idx on public.asi_video_event_reviews(reviewer_id);
alter table public.asi_video_event_reviews enable row level security;
create policy asi_video_event_reviews_admin_read on public.asi_video_event_reviews for select to authenticated using((select private.is_admin()));
create policy asi_video_event_reviews_admin_insert on public.asi_video_event_reviews for insert to authenticated with check((select private.is_admin()) and reviewer_id=(select auth.uid()));
grant select,insert on public.asi_video_event_reviews to authenticated;

create or replace function public.asi_review_video_event(p_event_id uuid,p_decision text,p_reason text)
returns jsonb
language plpgsql security invoker
set search_path=pg_catalog,public,private
as $$
declare v_actor uuid:=auth.uid(); v_row public.asi_video_event_tags%rowtype;
begin
 if v_actor is null or not private.is_admin() then raise exception 'admin_required' using errcode='42501'; end if;
 if p_decision not in ('verify','reject') or length(trim(coalesce(p_reason,'')))<10 then raise exception 'invalid_review' using errcode='22023'; end if;
 select * into v_row from public.asi_video_event_tags where id=p_event_id for update;
 if not found then raise exception 'video_event_not_found' using errcode='P0002'; end if;
 if v_row.verification_status<>'pending' then raise exception 'video_event_already_reviewed' using errcode='55000'; end if;
 insert into public.asi_video_event_reviews(event_id,reviewer_id,decision,reason,previous_state)
 values(v_row.id,v_actor,p_decision,trim(p_reason),jsonb_build_object('verification_status',v_row.verification_status,'event_type',v_row.event_type,'minute',v_row.minute));
 update public.asi_video_event_tags set verification_status=case when p_decision='verify' then 'verified' else 'rejected' end where id=v_row.id;
 return jsonb_build_object('event_id',v_row.id,'decision',p_decision,'reviewed_by',v_actor);
end;
$$;
revoke all on function public.asi_review_video_event(uuid,text,text) from public,anon;
grant execute on function public.asi_review_video_event(uuid,text,text) to authenticated;
