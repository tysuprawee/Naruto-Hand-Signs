begin;

create or replace function public.admin_get_user_ratings(
  p_password text,
  p_limit integer default 180,
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
  v_limit integer := greatest(1, least(coalesce(p_limit, 180), 500));
  v_retry_seconds integer := 0;
  v_rating_count integer := 0;
  v_rating_avg numeric := 0;
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
    count(*)::integer,
    coalesce(avg(ur.stars::numeric), 0)
  into v_rating_count, v_rating_avg
  from public.user_ratings ur;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
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
      ur.id,
      ur.stars,
      coalesce(ur.comment, '') as comment,
      coalesce(ur.prompt_context->>'suggestion', '') as suggestion,
      nullif(trim(coalesce(ur.username, '')), '') as username,
      ur.discord_id,
      ur.run_mode,
      ur.jutsu_name,
      ur.created_at
    from public.user_ratings ur
    order by ur.created_at desc
    limit v_limit
  ) r;

  return jsonb_build_object(
    'ok', true,
    'rows', v_rows,
    'rating_count', v_rating_count,
    'rating_avg', round(v_rating_avg, 2)
  );
exception
  when undefined_function then
    return jsonb_build_object(
      'ok', false,
      'reason', 'missing_admin_stats_function',
      'detail', 'admin_dashboard_stats function is required before admin_get_user_ratings.'
    );
  when undefined_table then
    return jsonb_build_object(
      'ok', false,
      'reason', 'missing_user_ratings_table',
      'detail', 'user_ratings table is missing. Run sql/user_ratings.sql first.'
    );
  when others then
    return jsonb_build_object(
      'ok', false,
      'reason', 'rpc_exception',
      'detail', left(sqlerrm, 240)
    );
end;
$$;

revoke all on function public.admin_get_user_ratings(text, integer, text, text, text) from public;
grant execute on function public.admin_get_user_ratings(text, integer, text, text, text) to anon, authenticated, service_role;

commit;
