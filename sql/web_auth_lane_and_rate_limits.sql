begin;

-- Web-only auth lane + legacy RPC throttles.
-- Safe for pygame: legacy *_bound RPC names remain available.

create table if not exists public.rpc_rate_limits (
  bucket text not null,
  identity text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint rpc_rate_limits_pkey primary key (bucket, identity, window_start)
);

revoke all on table public.rpc_rate_limits from public, anon, authenticated;
alter table public.rpc_rate_limits enable row level security;

-- Provider-agnostic account binding (auth.uid) for web lane.
alter table if exists public.profiles
  add column if not exists auth_user_id uuid;

create unique index if not exists profiles_auth_user_id_uidx
  on public.profiles(auth_user_id)
  where auth_user_id is not null;

-- Best-effort backfill for existing Discord-linked profiles.
with auth_candidates as (
  select
    u.id as auth_user_id,
    nullif(trim(coalesce(u.raw_user_meta_data->>'provider_id', '')), '') as provider_id,
    nullif(trim(coalesce(u.raw_user_meta_data->>'user_id', '')), '') as user_id,
    nullif(trim(coalesce(u.raw_user_meta_data->>'id', '')), '') as user_meta_id,
    nullif(trim(coalesce(u.raw_user_meta_data->>'sub', '')), '') as sub_id,
    nullif(trim(coalesce(u.raw_app_meta_data->>'provider_id', '')), '') as app_provider_id,
    nullif(trim(coalesce(u.raw_app_meta_data->>'discord_id', '')), '') as app_discord_id
  from auth.users u
),
auth_external_ids as (
  select
    auth_user_id,
    unnest(array[provider_id, user_id, user_meta_id, sub_id, app_provider_id, app_discord_id]) as external_id
  from auth_candidates
),
mapped as (
  select distinct
    p.id as profile_id,
    e.auth_user_id
  from public.profiles p
  join auth_external_ids e
    on e.external_id is not null
   and e.external_id <> ''
   and coalesce(p.discord_id, '') = e.external_id
  where p.auth_user_id is null
)
update public.profiles p
set auth_user_id = m.auth_user_id,
    updated_at = now()
from mapped m
where p.id = m.profile_id
  and p.auth_user_id is null;

create or replace function public.rpc_rate_limit_hit(
  p_bucket text,
  p_identity text,
  p_window_seconds integer,
  p_max_hits integer
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := now();
  v_bucket text := left(trim(coalesce(p_bucket, '')), 64);
  v_identity text := left(trim(coalesce(p_identity, '')), 128);
  v_window integer := greatest(1, least(coalesce(p_window_seconds, 60), 3600));
  v_max integer := greatest(1, least(coalesce(p_max_hits, 30), 10000));
  v_window_start timestamptz;
  v_hits integer := 0;
begin
  if v_bucket = '' or v_identity = '' then
    return true;
  end if;

  v_window_start := to_timestamp(floor(extract(epoch from v_now) / v_window) * v_window);

  insert into public.rpc_rate_limits (bucket, identity, window_start, hits, updated_at)
  values (v_bucket, v_identity, v_window_start, 1, v_now)
  on conflict (bucket, identity, window_start)
  do update
    set hits = public.rpc_rate_limits.hits + 1,
        updated_at = excluded.updated_at
  returning hits into v_hits;

  if random() < 0.02 then
    delete from public.rpc_rate_limits
    where updated_at < (v_now - interval '2 days');
  end if;

  return v_hits <= v_max;
end;
$$;

revoke all on function public.rpc_rate_limit_hit(text, text, integer, integer) from public;

create or replace function public.auth_session_discord_id()
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_auth_provider text := '';
  v_auth_providers jsonb := '[]'::jsonb;
  v_candidate text := '';
begin
  if v_uid is null then
    return '';
  end if;

  select
    lower(trim(coalesce(u.raw_app_meta_data->>'provider', ''))),
    coalesce(u.raw_app_meta_data->'providers', '[]'::jsonb),
    coalesce(
      nullif(trim(coalesce(u.raw_user_meta_data->>'provider_id', '')), ''),
      nullif(trim(coalesce(u.raw_user_meta_data->>'user_id', '')), ''),
      nullif(trim(coalesce(u.raw_user_meta_data->>'id', '')), ''),
      nullif(trim(coalesce(u.raw_user_meta_data->>'sub', '')), ''),
      nullif(trim(coalesce(u.raw_app_meta_data->>'provider_id', '')), ''),
      nullif(trim(coalesce(u.raw_app_meta_data->>'discord_id', '')), '')
    )
  into v_auth_provider, v_auth_providers, v_candidate
  from auth.users u
  where u.id = v_uid
  limit 1;

  if v_auth_provider <> 'discord'
    and not (v_auth_providers ? 'discord') then
    return '';
  end if;

  if nullif(trim(coalesce(v_candidate, '')), '') is not null then
    return trim(v_candidate);
  end if;

  return '';
end;
$$;

revoke all on function public.auth_session_discord_id() from public;

create or replace function public.auth_guard_discord_identity(
  p_username text,
  p_discord_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_username text := trim(coalesce(p_username, ''));
  v_input_discord text := trim(coalesce(p_discord_id, ''));
  v_session_discord text;
  v_profile_id uuid;
  v_profile_username text;
  v_profile_discord text;
  v_profile_auth_user_id uuid;
  v_effective_discord text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  end if;
  if v_username = '' then
    return jsonb_build_object('ok', false, 'reason', 'missing_username');
  end if;

  select
    p.id,
    trim(coalesce(p.username, '')),
    trim(coalesce(p.discord_id, '')),
    p.auth_user_id
  into
    v_profile_id,
    v_profile_username,
    v_profile_discord,
    v_profile_auth_user_id
  from public.profiles p
  where lower(p.username) = lower(v_username)
  limit 1;

  if found then
    if v_profile_auth_user_id is not null and v_profile_auth_user_id <> v_uid then
      return jsonb_build_object('ok', false, 'reason', 'session_identity_mismatch');
    end if;

    if v_profile_auth_user_id is null then
      v_session_discord := trim(coalesce(public.auth_session_discord_id(), ''));
      if v_profile_discord <> '' then
        if (v_session_discord <> '' and v_session_discord = v_profile_discord)
           or (v_input_discord <> '' and v_input_discord = v_profile_discord) then
          update public.profiles p
          set auth_user_id = v_uid,
              updated_at = now()
          where p.id = v_profile_id
            and (p.auth_user_id is null or p.auth_user_id = v_uid);
        else
          return jsonb_build_object('ok', false, 'reason', 'identity_mismatch');
        end if;
      else
        update public.profiles p
        set auth_user_id = v_uid,
            updated_at = now()
        where p.id = v_profile_id
          and (p.auth_user_id is null or p.auth_user_id = v_uid);
      end if;
    end if;

    v_effective_discord := coalesce(nullif(v_profile_discord, ''), nullif(v_input_discord, ''), v_uid::text);
    return jsonb_build_object(
      'ok', true,
      'username', coalesce(nullif(v_profile_username, ''), v_username),
      'discord_id', v_effective_discord,
      'auth_user_id', v_uid::text
    );
  end if;

  v_effective_discord := coalesce(nullif(v_input_discord, ''), v_uid::text);
  return jsonb_build_object(
    'ok', true,
    'username', v_username,
    'discord_id', v_effective_discord,
    'auth_user_id', v_uid::text
  );
end;
$$;

revoke all on function public.auth_guard_discord_identity(text, text) from public;

-- Legacy RPC throttle patch (keeps existing pygame clients working)
create or replace function public.issue_run_token_bound(
    p_username text,
    p_discord_id text,
    p_mode text,
    p_client_started_at text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_result jsonb;
    v_rate_identity text;
begin
    if trim(coalesce(p_username, '')) = '' then
        return jsonb_build_object('ok', false, 'reason', 'missing_username');
    end if;
    if trim(coalesce(p_discord_id, '')) = '' then
        return jsonb_build_object('ok', false, 'reason', 'missing_discord_id');
    end if;

    v_rate_identity := lower(trim(coalesce(p_discord_id, '')));
    if not public.rpc_rate_limit_hit('issue_run_token_bound', v_rate_identity, 60, 60) then
        return jsonb_build_object('ok', false, 'reason', 'rate_limited');
    end if;

    if not public.identity_match_username_discord(p_username, p_discord_id) then
        return jsonb_build_object('ok', false, 'reason', 'identity_mismatch');
    end if;

    select to_jsonb(x)
    into v_result
    from public.issue_run_token(p_username, p_mode, p_client_started_at) as x
    limit 1;

    if v_result is null then
        return jsonb_build_object('ok', false, 'reason', 'token_issue_failed');
    end if;
    if jsonb_typeof(v_result) = 'object' then
        return v_result;
    end if;
    return jsonb_build_object('ok', true, 'result', v_result);
exception
    when others then
        return jsonb_build_object('ok', false, 'reason', 'rpc_exception', 'detail', left(sqlerrm, 240));
end;
$$;

create or replace function public.submit_challenge_run_secure_bound(
    p_username text,
    p_discord_id text,
    p_mode text,
    p_score_time numeric,
    p_run_token text,
    p_events jsonb,
    p_run_hash text,
    p_metadata jsonb,
    p_avatar_url text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_result jsonb;
    v_token_username text;
    v_rate_identity text;
begin
    if trim(coalesce(p_username, '')) = '' then
        return jsonb_build_object('ok', false, 'reason', 'missing_username');
    end if;
    if trim(coalesce(p_discord_id, '')) = '' then
        return jsonb_build_object('ok', false, 'reason', 'missing_discord_id');
    end if;
    if trim(coalesce(p_run_token, '')) = '' then
        return jsonb_build_object('ok', false, 'reason', 'missing_run_token');
    end if;

    v_rate_identity := lower(trim(coalesce(p_discord_id, '')));
    if not public.rpc_rate_limit_hit('submit_challenge_run_secure_bound', v_rate_identity, 60, 40) then
        return jsonb_build_object('ok', false, 'reason', 'rate_limited');
    end if;

    if not public.identity_match_username_discord(p_username, p_discord_id) then
        return jsonb_build_object('ok', false, 'reason', 'identity_mismatch');
    end if;

    select t.username
    into v_token_username
    from public.challenge_run_tokens t
    where t.token = p_run_token
    limit 1;

    if v_token_username is not null and lower(v_token_username) <> lower(trim(p_username)) then
        return jsonb_build_object('ok', false, 'reason', 'token_username_mismatch');
    end if;

    select to_jsonb(x)
    into v_result
    from public.submit_challenge_run_secure(
        p_username,
        p_mode,
        p_score_time,
        p_run_token,
        coalesce(p_events, '[]'::jsonb),
        coalesce(p_run_hash, ''),
        coalesce(p_metadata, '{}'::jsonb),
        p_discord_id,
        p_avatar_url
    ) as x
    limit 1;

    if v_result is null then
        return jsonb_build_object('ok', false, 'reason', 'submit_failed');
    end if;
    if jsonb_typeof(v_result) = 'object' then
        return v_result;
    end if;
    return jsonb_build_object('ok', true, 'result', v_result);
exception
    when others then
        return jsonb_build_object('ok', false, 'reason', 'rpc_exception', 'detail', left(sqlerrm, 240));
end;
$$;

-- Keep legacy grants for shipped pygame builds.
grant execute on function public.issue_run_token_bound(text, text, text, text) to anon, authenticated;
grant execute on function public.submit_challenge_run_secure_bound(text, text, text, numeric, text, jsonb, text, jsonb, text) to anon, authenticated;

-- Web-only authenticated lane (session-bound Discord identity)
create or replace function public.issue_run_token_bound_auth(
    p_username text,
    p_discord_id text,
    p_mode text,
    p_client_started_at text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_guard jsonb;
begin
    v_guard := public.auth_guard_discord_identity(p_username, p_discord_id);
    if coalesce(v_guard->>'ok', 'false') <> 'true' then
        return v_guard;
    end if;

    return public.issue_run_token_bound(
      v_guard->>'username',
      v_guard->>'discord_id',
      p_mode,
      p_client_started_at
    );
exception
    when others then
        return jsonb_build_object('ok', false, 'reason', 'rpc_exception', 'detail', left(sqlerrm, 240));
end;
$$;

create or replace function public.submit_challenge_run_secure_bound_auth(
    p_username text,
    p_discord_id text,
    p_mode text,
    p_score_time numeric,
    p_run_token text,
    p_events jsonb,
    p_run_hash text,
    p_metadata jsonb,
    p_avatar_url text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_guard jsonb;
begin
    v_guard := public.auth_guard_discord_identity(p_username, p_discord_id);
    if coalesce(v_guard->>'ok', 'false') <> 'true' then
        return v_guard;
    end if;

    return public.submit_challenge_run_secure_bound(
      v_guard->>'username',
      v_guard->>'discord_id',
      p_mode,
      p_score_time,
      p_run_token,
      p_events,
      p_run_hash,
      p_metadata,
      p_avatar_url
    );
exception
    when others then
        return jsonb_build_object('ok', false, 'reason', 'rpc_exception', 'detail', left(sqlerrm, 240));
end;
$$;

create or replace function public.get_competitive_state_authoritative_bound_auth(
    p_username text,
    p_discord_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_guard jsonb;
begin
    v_guard := public.auth_guard_discord_identity(p_username, p_discord_id);
    if coalesce(v_guard->>'ok', 'false') <> 'true' then
        return v_guard;
    end if;

    return public.get_competitive_state_authoritative_bound(
      v_guard->>'username',
      v_guard->>'discord_id'
    );
exception
    when others then
        return jsonb_build_object('ok', false, 'reason', 'rpc_exception', 'detail', left(sqlerrm, 240));
end;
$$;

create or replace function public.award_jutsu_completion_authoritative_bound_auth(
    p_username text,
    p_discord_id text,
    p_xp_gain integer,
    p_signs_landed integer,
    p_is_challenge boolean,
    p_mode text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_guard jsonb;
begin
    v_guard := public.auth_guard_discord_identity(p_username, p_discord_id);
    if coalesce(v_guard->>'ok', 'false') <> 'true' then
        return v_guard;
    end if;

    return public.award_jutsu_completion_authoritative_bound(
      v_guard->>'username',
      v_guard->>'discord_id',
      p_xp_gain,
      p_signs_landed,
      p_is_challenge,
      p_mode
    );
exception
    when others then
        return jsonb_build_object('ok', false, 'reason', 'rpc_exception', 'detail', left(sqlerrm, 240));
end;
$$;

create or replace function public.claim_quest_authoritative_bound_auth(
    p_username text,
    p_discord_id text,
    p_scope text,
    p_quest_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_guard jsonb;
begin
    v_guard := public.auth_guard_discord_identity(p_username, p_discord_id);
    if coalesce(v_guard->>'ok', 'false') <> 'true' then
        return v_guard;
    end if;

    return public.claim_quest_authoritative_bound(
      v_guard->>'username',
      v_guard->>'discord_id',
      p_scope,
      p_quest_id
    );
exception
    when others then
        return jsonb_build_object('ok', false, 'reason', 'rpc_exception', 'detail', left(sqlerrm, 240));
end;
$$;

create or replace function public.upsert_profile_guarded_bound_auth(
    p_username text,
    p_discord_id text,
    p_xp integer,
    p_level integer,
    p_rank text,
    p_total_signs integer,
    p_total_jutsus integer,
    p_fastest_combo integer,
    p_tutorial_seen boolean,
    p_tutorial_seen_at timestamptz,
    p_tutorial_version text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_guard jsonb;
begin
    v_guard := public.auth_guard_discord_identity(p_username, p_discord_id);
    if coalesce(v_guard->>'ok', 'false') <> 'true' then
        return v_guard;
    end if;

    return public.upsert_profile_guarded_bound(
      v_guard->>'username',
      v_guard->>'discord_id',
      p_xp,
      p_level,
      p_rank,
      p_total_signs,
      p_total_jutsus,
      p_fastest_combo,
      p_tutorial_seen,
      p_tutorial_seen_at,
      p_tutorial_version
    );
exception
    when others then
        return jsonb_build_object('ok', false, 'reason', 'rpc_exception', 'detail', left(sqlerrm, 240));
end;
$$;

create or replace function public.upsert_profile_meta_guarded_bound_auth(
    p_username text,
    p_discord_id text,
    p_tutorial_seen boolean,
    p_tutorial_seen_at timestamptz,
    p_tutorial_version text,
    p_mastery jsonb,
    p_quests jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_guard jsonb;
begin
    v_guard := public.auth_guard_discord_identity(p_username, p_discord_id);
    if coalesce(v_guard->>'ok', 'false') <> 'true' then
        return v_guard;
    end if;

    return public.upsert_profile_meta_guarded_bound(
      v_guard->>'username',
      v_guard->>'discord_id',
      p_tutorial_seen,
      p_tutorial_seen_at,
      p_tutorial_version,
      p_mastery,
      p_quests
    );
exception
    when others then
        return jsonb_build_object('ok', false, 'reason', 'rpc_exception', 'detail', left(sqlerrm, 240));
end;
$$;

create or replace function public.bind_profile_identity_bound_auth(
    p_username text,
    p_discord_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_guard jsonb;
begin
    v_guard := public.auth_guard_discord_identity(p_username, p_discord_id);
    if coalesce(v_guard->>'ok', 'false') <> 'true' then
        return v_guard;
    end if;

    return public.bind_profile_identity_bound(
      v_guard->>'username',
      v_guard->>'discord_id'
    );
exception
    when others then
        return jsonb_build_object('ok', false, 'reason', 'rpc_exception', 'detail', left(sqlerrm, 240));
end;
$$;

create or replace function public.get_profile_settings_bound_auth(
    p_username text,
    p_discord_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_guard jsonb;
begin
    v_guard := public.auth_guard_discord_identity(p_username, p_discord_id);
    if coalesce(v_guard->>'ok', 'false') <> 'true' then
        return v_guard;
    end if;

    return public.get_profile_settings_bound(
      v_guard->>'username',
      v_guard->>'discord_id'
    );
exception
    when others then
        return jsonb_build_object('ok', false, 'reason', 'rpc_exception', 'detail', left(sqlerrm, 240));
end;
$$;

create or replace function public.upsert_profile_settings_bound_auth(
    p_username text,
    p_discord_id text,
    p_user_settings jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_guard jsonb;
begin
    v_guard := public.auth_guard_discord_identity(p_username, p_discord_id);
    if coalesce(v_guard->>'ok', 'false') <> 'true' then
        return v_guard;
    end if;

    return public.upsert_profile_settings_bound(
      v_guard->>'username',
      v_guard->>'discord_id',
      p_user_settings
    );
exception
    when others then
        return jsonb_build_object('ok', false, 'reason', 'rpc_exception', 'detail', left(sqlerrm, 240));
end;
$$;

create or replace function public.get_calibration_profile_bound_auth(
    p_username text,
    p_discord_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_guard jsonb;
begin
    v_guard := public.auth_guard_discord_identity(p_username, p_discord_id);
    if coalesce(v_guard->>'ok', 'false') <> 'true' then
        return v_guard;
    end if;

    return public.get_calibration_profile_bound(
      v_guard->>'username',
      v_guard->>'discord_id'
    );
exception
    when others then
        return jsonb_build_object('ok', false, 'reason', 'rpc_exception', 'detail', left(sqlerrm, 240));
end;
$$;

create or replace function public.upsert_calibration_profile_bound_auth(
    p_username text,
    p_discord_id text,
    p_calibration_profile jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_guard jsonb;
begin
    v_guard := public.auth_guard_discord_identity(p_username, p_discord_id);
    if coalesce(v_guard->>'ok', 'false') <> 'true' then
        return v_guard;
    end if;

    return public.upsert_calibration_profile_bound(
      v_guard->>'username',
      v_guard->>'discord_id',
      p_calibration_profile
    );
exception
    when others then
        return jsonb_build_object('ok', false, 'reason', 'rpc_exception', 'detail', left(sqlerrm, 240));
end;
$$;

-- Web lane grants: authenticated only
revoke all on function public.issue_run_token_bound_auth(text, text, text, text) from public, anon;
revoke all on function public.submit_challenge_run_secure_bound_auth(text, text, text, numeric, text, jsonb, text, jsonb, text) from public, anon;
revoke all on function public.get_competitive_state_authoritative_bound_auth(text, text) from public, anon;
revoke all on function public.award_jutsu_completion_authoritative_bound_auth(text, text, integer, integer, boolean, text) from public, anon;
revoke all on function public.claim_quest_authoritative_bound_auth(text, text, text, text) from public, anon;
revoke all on function public.upsert_profile_guarded_bound_auth(text, text, integer, integer, text, integer, integer, integer, boolean, timestamptz, text) from public, anon;
revoke all on function public.upsert_profile_meta_guarded_bound_auth(text, text, boolean, timestamptz, text, jsonb, jsonb) from public, anon;
revoke all on function public.bind_profile_identity_bound_auth(text, text) from public, anon;
revoke all on function public.get_profile_settings_bound_auth(text, text) from public, anon;
revoke all on function public.upsert_profile_settings_bound_auth(text, text, jsonb) from public, anon;
revoke all on function public.get_calibration_profile_bound_auth(text, text) from public, anon;
revoke all on function public.upsert_calibration_profile_bound_auth(text, text, jsonb) from public, anon;

grant execute on function public.issue_run_token_bound_auth(text, text, text, text) to authenticated;
grant execute on function public.submit_challenge_run_secure_bound_auth(text, text, text, numeric, text, jsonb, text, jsonb, text) to authenticated;
grant execute on function public.get_competitive_state_authoritative_bound_auth(text, text) to authenticated;
grant execute on function public.award_jutsu_completion_authoritative_bound_auth(text, text, integer, integer, boolean, text) to authenticated;
grant execute on function public.claim_quest_authoritative_bound_auth(text, text, text, text) to authenticated;
grant execute on function public.upsert_profile_guarded_bound_auth(text, text, integer, integer, text, integer, integer, integer, boolean, timestamptz, text) to authenticated;
grant execute on function public.upsert_profile_meta_guarded_bound_auth(text, text, boolean, timestamptz, text, jsonb, jsonb) to authenticated;
grant execute on function public.bind_profile_identity_bound_auth(text, text) to authenticated;
grant execute on function public.get_profile_settings_bound_auth(text, text) to authenticated;
grant execute on function public.upsert_profile_settings_bound_auth(text, text, jsonb) to authenticated;
grant execute on function public.get_calibration_profile_bound_auth(text, text) to authenticated;
grant execute on function public.upsert_calibration_profile_bound_auth(text, text, jsonb) to authenticated;

commit;
