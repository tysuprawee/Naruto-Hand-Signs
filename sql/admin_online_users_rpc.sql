begin;

create or replace function public.admin_get_online_users(
  p_password text,
  p_limit integer default 200,
  p_window_seconds integer default 90,
  p_client_id text default '',
  p_user_agent text default '',
  p_ip text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_auth jsonb;
  v_rows jsonb := '[]'::jsonb;
  v_limit integer := greatest(1, least(coalesce(p_limit, 200), 500));
  v_window_seconds integer := greatest(30, least(coalesce(p_window_seconds, 90), 300));
  v_retry_seconds integer := 0;
  v_online_now integer := 0;
  v_peak_today integer := 0;
  v_now timestamptz := now();
  v_today_start timestamptz := date_trunc('day', now());
  v_has_presence_log boolean := false;
begin
  -- Reuse existing admin password + lockout validation.
  select public.admin_dashboard_stats(
    p_password,
    'UTC',
    p_client_id,
    p_user_agent,
    p_ip
  ) into v_auth;

  if coalesce(v_auth->>'ok', 'false') <> 'true' then
    begin
      v_retry_seconds := coalesce((v_auth->>'retry_seconds')::integer, 0);
    exception
      when others then
        v_retry_seconds := 0;
    end;
    return jsonb_build_object(
      'ok', false,
      'reason', coalesce(v_auth->>'reason', 'unauthorized'),
      'detail', coalesce(v_auth->>'detail', ''),
      'retry_seconds', v_retry_seconds
    );
  end if;

  with profile_rows as (
    select
      p.username,
      p.updated_at as last_seen_at,
      (p.updated_at > (v_now - make_interval(secs => v_window_seconds))) as is_online_guess
    from public.profiles p
    where p.updated_at is not null
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'username', q.username,
          'last_seen_at', q.last_seen_at,
          'is_online_guess', q.is_online_guess
        )
        order by q.last_seen_at desc
      ),
      '[]'::jsonb
    ),
    (
      select coalesce(sum(case when pr.is_online_guess then 1 else 0 end), 0)
      from profile_rows pr
    )
  into v_rows, v_online_now
  from (
    select *
    from profile_rows
    order by last_seen_at desc
    limit v_limit
  ) q;

  -- Peak guess today:
  -- Prefer history from profile_presence_events (true per-update heartbeat stream).
  -- Fallback to current online guess when history table is not installed yet.
  select to_regclass('public.profile_presence_events') is not null into v_has_presence_log;

  if v_has_presence_log then
    with seen_today as (
      select
        coalesce(
          nullif(trim(coalesce(e.username, '')), ''),
          nullif(trim(coalesce(e.discord_id, '')), ''),
          e.auth_user_id::text,
          e.profile_id::text
        ) as user_key,
        e.seen_at
      from public.profile_presence_events e
      where e.seen_at is not null
        and e.seen_at >= v_today_start
        and e.seen_at <= v_now
    ),
    anchors as (
      select distinct s.seen_at as anchor_ts
      from seen_today s
    ),
    peaks as (
      select
        count(distinct s.user_key)::integer as concurrent_guess
      from anchors a
      join seen_today s
        on s.seen_at > (a.anchor_ts - make_interval(secs => v_window_seconds))
       and s.seen_at <= a.anchor_ts
      group by a.anchor_ts
    )
    select coalesce(max(peaks.concurrent_guess), 0)
    into v_peak_today
    from peaks;
  else
    v_peak_today := v_online_now;
  end if;

  v_peak_today := greatest(v_peak_today, v_online_now);

  return jsonb_build_object(
    'ok', true,
    'rows', v_rows,
    'online_now', v_online_now,
    'peak_online_today', v_peak_today,
    'window_seconds', v_window_seconds,
    'generated_at', v_now
  );
exception
  when undefined_function then
    return jsonb_build_object(
      'ok', false,
      'reason', 'missing_admin_stats_function',
      'detail', 'admin_dashboard_stats function is required before admin_get_online_users.'
    );
  when undefined_table then
    return jsonb_build_object(
      'ok', false,
      'reason', 'missing_profiles_table',
      'detail', 'profiles table is missing.'
    );
  when others then
    return jsonb_build_object(
      'ok', false,
      'reason', 'rpc_exception',
      'detail', left(sqlerrm, 240)
    );
end;
$$;

revoke all on function public.admin_get_online_users(text, integer, integer, text, text, text) from public;
grant execute on function public.admin_get_online_users(text, integer, integer, text, text, text) to anon, authenticated, service_role;

commit;
