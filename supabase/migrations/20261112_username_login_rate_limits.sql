-- PFSS username-login distributed rate limit
-- Additive, data-minimizing control. Stores only SHA-256 hashes of normalized
-- usernames, never raw usernames, passwords, email addresses or IP addresses.
-- Apply and test on a separate Supabase project before enabling the updated
-- username-login Edge Function. Do not run automatically against production.

create table if not exists public.pfss_username_login_limits (
  key_hash text primary key
    check (key_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  attempts integer not null check (attempts >= 1),
  updated_at timestamptz not null
);

create index if not exists pfss_username_login_limits_updated_idx
  on public.pfss_username_login_limits(updated_at);

alter table public.pfss_username_login_limits enable row level security;
revoke all on public.pfss_username_login_limits from public, anon, authenticated;

create or replace function public.pfss_consume_username_login_limit(
  p_key_hash text,
  p_max_attempts integer default 8,
  p_window_seconds integer default 900
)
returns table (
  allowed boolean,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := now();
  v_window_started timestamptz;
  v_attempts integer;
  v_retry_after integer;
begin
  if p_key_hash is null or p_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid rate-limit key';
  end if;
  if p_max_attempts < 1 or p_max_attempts > 20 then
    raise exception 'Invalid rate-limit threshold';
  end if;
  if p_window_seconds < 60 or p_window_seconds > 3600 then
    raise exception 'Invalid rate-limit window';
  end if;

  -- The UPSERT is atomic, so parallel Edge Function instances share one
  -- counter instead of relying on process-local memory.
  insert into public.pfss_username_login_limits as existing
    (key_hash, window_started_at, attempts, updated_at)
  values
    (p_key_hash, v_now, 1, v_now)
  on conflict (key_hash) do update
    set window_started_at = case
          when existing.window_started_at + make_interval(secs => p_window_seconds) <= v_now
          then v_now else existing.window_started_at end,
        attempts = case
          when existing.window_started_at + make_interval(secs => p_window_seconds) <= v_now
          then 1 else existing.attempts + 1 end,
        updated_at = v_now
  returning window_started_at, attempts
  into v_window_started, v_attempts;

  v_retry_after := greatest(
    0,
    ceil(extract(epoch from (
      v_window_started + make_interval(secs => p_window_seconds) - v_now
    )))::integer
  );

  -- Opportunistic cleanup bounds stale-key accumulation without requiring
  -- pg_cron. The updated_at index keeps this periodic task targeted.
  if mod(extract(epoch from v_now)::bigint, 300) = 0 then
    delete from public.pfss_username_login_limits
    where updated_at < v_now - interval '1 day';
  end if;

  return query select (v_attempts <= p_max_attempts), v_retry_after;
end;
$$;

revoke all on function public.pfss_consume_username_login_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.pfss_consume_username_login_limit(text, integer, integer)
  to service_role;

comment on table public.pfss_username_login_limits is
  'Server-only rate-limit counters keyed by SHA-256 username hash; no raw user identifiers.';
comment on function public.pfss_consume_username_login_limit(text, integer, integer) is
  'Atomic distributed username login rate limiter. Execute only with service_role.';
