-- Audited, human-controlled lifecycle for trained model candidates.
create table if not exists public.asi_model_reviews (
  id uuid primary key default gen_random_uuid(),
  model_version_id uuid not null references public.asi_model_versions(id),
  reviewer_id uuid not null references auth.users(id),
  decision text not null check (decision in ('approve','reject')),
  reason text not null check (length(btrim(reason)) >= 10),
  created_at timestamptz not null default now()
);
alter table public.asi_model_reviews enable row level security;
drop policy if exists asi_model_reviews_admin_select on public.asi_model_reviews;
create policy asi_model_reviews_admin_select on public.asi_model_reviews for select to authenticated using ((select private.is_admin()));
drop policy if exists asi_model_reviews_admin_insert on public.asi_model_reviews;
create policy asi_model_reviews_admin_insert on public.asi_model_reviews for insert to authenticated with check (reviewer_id=(select auth.uid()) and (select private.is_admin()));
revoke update, delete on public.asi_model_reviews from authenticated, anon;
grant select, insert on public.asi_model_reviews to authenticated;
create or replace function public.asi_review_model_candidate(p_model_version_id uuid,p_decision text,p_reason text)
returns jsonb language plpgsql security invoker set search_path=public,private,pg_temp as $$
declare v_model public.asi_model_versions%rowtype;
begin
 if auth.uid() is null or not private.is_admin() then raise exception 'Administrator permission required' using errcode='42501'; end if;
 if p_decision not in ('approve','reject') or length(btrim(coalesce(p_reason,'')))<10 then raise exception 'A valid decision and reason of at least 10 characters are required'; end if;
 select * into v_model from public.asi_model_versions where id=p_model_version_id for update;
 if not found or v_model.status<>'candidate' then raise exception 'Only an existing candidate model can be reviewed'; end if;
 if p_decision='approve' then
  if not exists(select 1 from public.asi_model_evaluations e where e.model_version_id=v_model.id and e.passed=true) then raise exception 'Candidate has no passing evaluation'; end if;
  update public.asi_model_versions set status='retired' where model_key=v_model.model_key and status='active';
  update public.asi_model_versions set status='active',approved_by=auth.uid(),approved_at=now() where id=v_model.id;
 else
  update public.asi_model_versions set status='rejected',approved_by=auth.uid(),approved_at=now() where id=v_model.id;
 end if;
 insert into public.asi_model_reviews(model_version_id,reviewer_id,decision,reason) values(v_model.id,auth.uid(),p_decision,btrim(p_reason));
 return jsonb_build_object('model_version_id',v_model.id,'decision',p_decision,'status',case when p_decision='approve' then 'active' else 'rejected' end);
end; $$;
revoke all on function public.asi_review_model_candidate(uuid,text,text) from public,anon;
grant execute on function public.asi_review_model_candidate(uuid,text,text) to authenticated;
