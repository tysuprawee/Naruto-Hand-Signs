begin;

create or replace function public.admin_get_user_reports(
  p_password text,
  p_limit integer default 120,
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
  v_limit integer := greatest(1, least(coalesce(p_limit, 120), 300));
  v_retry_seconds integer := 0;
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

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'report_text', r.report_text,
        'page_path', r.page_path,
        'user_agent', r.user_agent,
        'auth_user_id', r.auth_user_id,
        'status', r.status,
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
      ur.report_text,
      ur.page_path,
      ur.user_agent,
      ur.auth_user_id,
      ur.status,
      ur.created_at
    from public.user_reports ur
    order by ur.created_at desc
    limit v_limit
  ) r;

  return jsonb_build_object(
    'ok', true,
    'rows', v_rows
  );
exception
  when undefined_function then
    return jsonb_build_object(
      'ok', false,
      'reason', 'missing_admin_stats_function',
      'detail', 'admin_dashboard_stats function is required before admin_get_user_reports.'
    );
  when undefined_table then
    return jsonb_build_object(
      'ok', false,
      'reason', 'missing_user_reports_table',
      'detail', 'user_reports table is missing. Run sql/user_reports.sql first.'
    );
  when others then
    return jsonb_build_object(
      'ok', false,
      'reason', 'rpc_exception',
      'detail', left(sqlerrm, 240)
    );
end;
$$;

revoke all on function public.admin_get_user_reports(text, integer, text, text, text) from public;
grant execute on function public.admin_get_user_reports(text, integer, text, text, text) to anon, authenticated, service_role;

commit;

