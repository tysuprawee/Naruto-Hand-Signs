begin;

create or replace function public.admin_get_user_rating_events(
  p_password text,
  p_limit integer default 240,
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
  v_limit integer := greatest(1, least(coalesce(p_limit, 240), 600));
  v_retry_seconds integer := 0;
  v_prompts_shown integer := 0;
  v_dismiss_not_now integer := 0;
  v_dismiss_never integer := 0;
  v_submissions integer := 0;
  v_no_feedback integer := 0;
  v_submit_rate numeric := 0;
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

  select
    count(*) filter (where ure.event_type = 'prompt_shown')::integer,
    count(*) filter (where ure.event_type = 'dismiss_not_now')::integer,
    count(*) filter (where ure.event_type = 'dismiss_never')::integer,
    count(*) filter (where ure.event_type = 'submitted')::integer
  into v_prompts_shown, v_dismiss_not_now, v_dismiss_never, v_submissions
  from public.user_rating_events ure;

  v_no_feedback := greatest(v_prompts_shown - v_submissions, 0);
  v_submit_rate := case
    when v_prompts_shown > 0
      then round((v_submissions::numeric * 100.0) / v_prompts_shown::numeric, 2)
    else 0
  end;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'event_type', r.event_type,
        'stars', r.stars,
        'comment', r.comment,
        'suggestion', r.suggestion,
        'username', r.username,
        'discord_id', r.discord_id,
        'run_mode', r.run_mode,
        'jutsu_name', r.jutsu_name,
        'created_at', r.created_at
      )
      order by r.created_at desc
    ),
    '[]'::jsonb
  )
  into v_rows
  from (
    select
      ure.id,
      ure.event_type,
      ure.stars,
      coalesce(ure.comment, '') as comment,
      coalesce(ure.suggestion, '') as suggestion,
      nullif(trim(coalesce(ure.username, '')), '') as username,
      ure.discord_id,
      ure.run_mode,
      ure.jutsu_name,
      ure.created_at
    from public.user_rating_events ure
    order by ure.created_at desc
    limit v_limit
  ) r;

  return jsonb_build_object(
    'ok', true,
    'rows', v_rows,
    'prompts_shown', v_prompts_shown,
    'dismiss_not_now', v_dismiss_not_now,
    'dismiss_never', v_dismiss_never,
    'submissions', v_submissions,
    'no_feedback', v_no_feedback,
    'submit_rate_pct', v_submit_rate
  );
exception
  when undefined_function then
    return jsonb_build_object(
      'ok', false,
      'reason', 'missing_admin_stats_function',
      'detail', 'admin_dashboard_stats function is required before admin_get_user_rating_events.'
    );
  when undefined_table then
    return jsonb_build_object(
      'ok', false,
      'reason', 'missing_user_rating_events_table',
      'detail', 'user_rating_events table is missing. Run sql/user_rating_events.sql first.'
    );
  when others then
    return jsonb_build_object(
      'ok', false,
      'reason', 'rpc_exception',
      'detail', left(sqlerrm, 240)
    );
end;
$$;

revoke all on function public.admin_get_user_rating_events(text, integer, text, text, text) from public;
grant execute on function public.admin_get_user_rating_events(text, integer, text, text, text) to anon, authenticated, service_role;

commit;
