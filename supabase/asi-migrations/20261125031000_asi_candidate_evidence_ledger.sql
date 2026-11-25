-- ASI candidate evidence ledger: candidate-scoped, review-gated and owner-isolated.
create unique index if not exists asi_candidates_id_owner_uidx
  on public.asi_player_candidates (id, owner_id);

create table if not exists public.asi_candidate_evidence (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  provider text,
  source_name text,
  source_type text not null default 'external_reference',
  source_url text not null,
  publisher text,
  license_id text,
  attribution text,
  claim_type text not null,
  claim_title text not null,
  claim_text text not null,
  evidence_excerpt text,
  published_at timestamptz,
  retrieved_at timestamptz not null default now(),
  identity_status text not null default 'pending',
  identity_confidence numeric,
  fact_confidence numeric,
  verification_status text not null default 'unconfirmed',
  data_classification text not null default 'ordinary',
  legal_review_status text not null default 'not_approved',
  review_status text not null default 'pending',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint asi_candidate_evidence_candidate_owner_fk
    foreign key (candidate_id, owner_id)
    references public.asi_player_candidates(id, owner_id) on delete cascade,
  constraint asi_candidate_evidence_https_url_check
    check (source_url ~ '^https://'),
  constraint asi_candidate_evidence_identity_status_check
    check (identity_status in ('pending','confirmed','ambiguous','rejected')),
  constraint asi_candidate_evidence_verification_status_check
    check (verification_status in ('unconfirmed','confirmed','corroborated','disputed')),
  constraint asi_candidate_evidence_classification_check
    check (data_classification in ('ordinary','sensitive','restricted')),
  constraint asi_candidate_evidence_legal_status_check
    check (legal_review_status in ('not_approved','approved','rejected')),
  constraint asi_candidate_evidence_review_status_check
    check (review_status in ('pending','approved','rejected')),
  constraint asi_candidate_evidence_identity_confidence_check
    check (identity_confidence is null or identity_confidence between 0 and 1),
  constraint asi_candidate_evidence_fact_confidence_check
    check (fact_confidence is null or fact_confidence between 0 and 1)
);

create index if not exists asi_candidate_evidence_candidate_created_idx
  on public.asi_candidate_evidence(candidate_id, created_at desc);
create index if not exists asi_candidate_evidence_review_queue_idx
  on public.asi_candidate_evidence(review_status, legal_review_status, created_at desc);

alter table public.asi_candidate_evidence enable row level security;

create policy asi_candidate_evidence_owner_read
  on public.asi_candidate_evidence for select to authenticated
  using (owner_id = (select auth.uid()) or (select private.is_admin()));

create policy asi_candidate_evidence_owner_insert_pending
  on public.asi_candidate_evidence for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and created_by = (select auth.uid())
    and review_status = 'pending'
    and legal_review_status = 'not_approved'
    and verification_status = 'unconfirmed'
    and identity_status = 'pending'
    and data_classification = 'ordinary'
    and reviewed_by is null
    and reviewed_at is null
  );

create policy asi_candidate_evidence_admin_all
  on public.asi_candidate_evidence for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create table if not exists public.asi_candidate_evidence_reviews (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references public.asi_candidate_evidence(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete restrict,
  decision text not null check (decision in ('approve','reject')),
  reason text not null check (length(trim(reason)) >= 10),
  previous_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.asi_candidate_evidence_reviews enable row level security;
create policy asi_candidate_evidence_reviews_admin_all
  on public.asi_candidate_evidence_reviews for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

grant select, insert, update on public.asi_candidate_evidence to authenticated;
grant select, insert on public.asi_candidate_evidence_reviews to authenticated;

create or replace function public.asi_review_candidate_evidence(
  p_evidence_id uuid,
  p_decision text,
  p_reason text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
declare
  v_actor uuid := auth.uid();
  v_evidence public.asi_candidate_evidence%rowtype;
begin
  if v_actor is null or not private.is_admin() then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  if p_decision not in ('approve','reject') then
    raise exception 'invalid_review_decision' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_reason,''))) < 10 then
    raise exception 'review_reason_too_short' using errcode = '22023';
  end if;

  select * into v_evidence
  from public.asi_candidate_evidence
  where id = p_evidence_id
  for update;

  if not found then
    raise exception 'candidate_evidence_not_found' using errcode = 'P0002';
  end if;
  if v_evidence.review_status <> 'pending' then
    raise exception 'candidate_evidence_already_reviewed' using errcode = '55000';
  end if;

  insert into public.asi_candidate_evidence_reviews(
    evidence_id, reviewer_id, decision, reason, previous_state
  ) values (
    v_evidence.id, v_actor, p_decision, trim(p_reason),
    jsonb_build_object(
      'review_status',v_evidence.review_status,
      'legal_review_status',v_evidence.legal_review_status,
      'verification_status',v_evidence.verification_status,
      'identity_status',v_evidence.identity_status
    )
  );

  update public.asi_candidate_evidence
  set review_status = case when p_decision = 'approve' then 'approved' else 'rejected' end,
      legal_review_status = case when p_decision = 'approve' then 'approved' else 'rejected' end,
      reviewed_by = v_actor,
      reviewed_at = now()
  where id = v_evidence.id;

  return jsonb_build_object('evidence_id',v_evidence.id,'decision',p_decision,'reviewed_by',v_actor);
end;
$$;

revoke all on function public.asi_review_candidate_evidence(uuid,text,text) from public, anon;
grant execute on function public.asi_review_candidate_evidence(uuid,text,text) to authenticated;
