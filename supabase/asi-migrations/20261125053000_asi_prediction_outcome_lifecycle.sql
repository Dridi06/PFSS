create or replace function public.asi_review_prediction_outcome(
 p_outcome_id uuid,p_decision text,p_reason text,p_source_url text default null
) returns jsonb
language plpgsql security invoker
set search_path=pg_catalog,public,private
as $$
declare v_actor uuid:=auth.uid(); v_row public.asi_prediction_outcomes%rowtype;
begin
 if v_actor is null or not private.is_admin() then raise exception 'admin_required' using errcode='42501'; end if;
 if p_decision not in ('verify','reject') or length(trim(coalesce(p_reason,'')))<10 then raise exception 'invalid_review' using errcode='22023'; end if;
 if p_decision='verify' and coalesce(p_source_url,'') !~ '^https://' then raise exception 'https_source_required' using errcode='22023'; end if;
 select * into v_row from public.asi_prediction_outcomes where id=p_outcome_id for update;
 if not found then raise exception 'prediction_outcome_not_found' using errcode='P0002'; end if;
 if v_row.verification_status<>'pending' then raise exception 'prediction_outcome_already_reviewed' using errcode='55000'; end if;
 insert into public.asi_prediction_outcome_reviews(outcome_id,reviewer_id,decision,reason,previous_state)
 values(v_row.id,v_actor,p_decision,trim(p_reason),jsonb_build_object('verification_status',v_row.verification_status,'observed_value',v_row.observed_value,'outcome_source',v_row.outcome_source));
 update public.asi_prediction_outcomes set
  verification_status=case when p_decision='verify' then 'verified' else 'rejected' end,
  verification_source_url=case when p_decision='verify' then p_source_url else null end,
  verified_by=v_actor,verified_at=now(),verification_reason=trim(p_reason)
 where id=v_row.id;
 if p_decision='verify' then
  update public.asi_prediction_records set status='observed' where id=v_row.prediction_id;
 end if;
 return jsonb_build_object('outcome_id',v_row.id,'decision',p_decision,'reviewed_by',v_actor);
end;
$$;
revoke all on function public.asi_review_prediction_outcome(uuid,text,text,text) from public,anon;
grant execute on function public.asi_review_prediction_outcome(uuid,text,text,text) to authenticated;
