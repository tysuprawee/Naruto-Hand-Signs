-- Competitive state hardening migration.
-- Goal: stop trusting client-supplied username by binding RPCs to username+discord_id.
-- Deploy this in Supabase SQL Editor, then restart client.

begin;

-- Ensure profile meta columns used by client exist.
alter table if exists public.profiles add column if not exists mastery jsonb not null default '{}'::jsonb;
alter table if exists public.profiles add column if not exists quests jsonb;
alter table if exists public.profiles add column if not exists tutorial_seen boolean not null default false;
alter table if exists public.profiles add column if not exists tutorial_seen_at timestamptz;
alter table if exists public.profiles add column if not exists tutorial_version text;
alter table if exists public.profiles add column if not exists user_settings jsonb not null default '{}'::jsonb;
alter table if exists public.profiles add column if not exists calibration_profile jsonb not null default '{}'::jsonb;

-- Helper: strict identity match for existing username rows.
create or replace function public.identity_match_username_discord(
    p_username text,
    p_discord_id text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where lower(p.username) = lower(trim(coalesce(p_username, '')))
      and coalesce(p.discord_id, '') = trim(coalesce(p_discord_id, ''))
  );
$$;

revoke all on function public.identity_match_username_discord(text, text) from public;
grant execute on function public.identity_match_username_discord(text, text) to anon, authenticated, service_role;

-- Helper: allow first-write bootstrap only when discord_id is not already bound to another username.
create or replace function public.identity_can_upsert_profile(
    p_username text,
    p_discord_id text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
    v_username text := lower(trim(coalesce(p_username, '')));
    v_discord_id text := trim(coalesce(p_discord_id, ''));
    v_existing_discord_id text;
begin
    if v_username = '' or v_discord_id = '' then
        return false;
    end if;

    select coalesce(p.discord_id, '')
    into v_existing_discord_id
    from public.profiles p
    where lower(p.username) = v_username
    limit 1;

    if found then
        if v_existing_discord_id = '' then
            if exists (
                select 1
                from public.profiles p
                where coalesce(p.discord_id, '') = v_discord_id
                  and lower(p.username) <> v_username
            ) then
                return false;
            end if;
            return true;
        end if;
        return v_existing_discord_id = v_discord_id;
    end if;

    if exists (
        select 1
        from public.profiles p
        where coalesce(p.discord_id, '') = v_discord_id
          and lower(p.username) <> v_username
    ) then
        return false;
    end if;

    return true;
end;
$$;

revoke all on function public.identity_can_upsert_profile(text, text) from public;
grant execute on function public.identity_can_upsert_profile(text, text) to anon, authenticated, service_role;

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
begin
    if trim(coalesce(p_username, '')) = '' then
        return jsonb_build_object('ok', false, 'reason', 'missing_username');
    end if;
    if trim(coalesce(p_discord_id, '')) = '' then
        return jsonb_build_object('ok', false, 'reason', 'missing_discord_id');
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

create or replace function public.get_competitive_state_authoritative_bound(
    p_username text,
    p_discord_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_result jsonb;
begin
    if trim(coalesce(p_username, '')) = '' then
        return jsonb_build_object('ok', false, 'reason', 'missing_username');
    end if;
    if trim(coalesce(p_discord_id, '')) = '' then
        return jsonb_build_object('ok', false, 'reason', 'missing_discord_id');
    end if;
    if not public.identity_match_username_discord(p_username, p_discord_id) then
        return jsonb_build_object('ok', false, 'reason', 'identity_mismatch');
    end if;

    select to_jsonb(x)
    into v_result
    from public.get_competitive_state_authoritative(p_username) as x
    limit 1;

    if v_result is null then
        return jsonb_build_object('ok', false, 'reason', 'state_unavailable');
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

create or replace function public.award_jutsu_completion_authoritative_bound(
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
    v_result jsonb;
begin
    if trim(coalesce(p_username, '')) = '' then
        return jsonb_build_object('ok', false, 'reason', 'missing_username');
    end if;
    if trim(coalesce(p_discord_id, '')) = '' then
        return jsonb_build_object('ok', false, 'reason', 'missing_discord_id');
    end if;
    if not public.identity_match_username_discord(p_username, p_discord_id) then
        return jsonb_build_object('ok', false, 'reason', 'identity_mismatch');
    end if;

    select to_jsonb(x)
    into v_result
    from public.award_jutsu_completion_authoritative(
        p_username,
        greatest(0, coalesce(p_xp_gain, 0)),
        greatest(0, coalesce(p_signs_landed, 0)),
        coalesce(p_is_challenge, false),
        coalesce(p_mode, '')
    ) as x
    limit 1;

    if v_result is null then
        return jsonb_build_object('ok', false, 'reason', 'award_failed');
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

create or replace function public.claim_quest_authoritative_bound(
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
    v_result jsonb;
begin
    if trim(coalesce(p_username, '')) = '' then
        return jsonb_build_object('ok', false, 'reason', 'missing_username');
    end if;
    if trim(coalesce(p_discord_id, '')) = '' then
        return jsonb_build_object('ok', false, 'reason', 'missing_discord_id');
    end if;
    if not public.identity_match_username_discord(p_username, p_discord_id) then
        return jsonb_build_object('ok', false, 'reason', 'identity_mismatch');
    end if;

    select to_jsonb(x)
    into v_result
    from public.claim_quest_authoritative(
        p_username,
        lower(coalesce(p_scope, '')),
        coalesce(p_quest_id, '')
    ) as x
    limit 1;

    if v_result is null then
        return jsonb_build_object('ok', false, 'reason', 'claim_failed');
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

create or replace function public.upsert_profile_guarded_bound(
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
begin
    if trim(coalesce(p_username, '')) = '' then
        return jsonb_build_object('ok', false, 'reason', 'missing_username');
    end if;
    if trim(coalesce(p_discord_id, '')) = '' then
        return jsonb_build_object('ok', false, 'reason', 'missing_discord_id');
    end if;
    if not public.identity_can_upsert_profile(p_username, p_discord_id) then
        return jsonb_build_object('ok', false, 'reason', 'identity_mismatch');
    end if;

    perform public.upsert_profile_guarded(
        p_username,
        greatest(0, coalesce(p_xp, 0)),
        greatest(0, coalesce(p_level, 0)),
        coalesce(p_rank, ''),
        greatest(0, coalesce(p_total_signs, 0)),
        greatest(0, coalesce(p_total_jutsus, 0)),
        greatest(0, coalesce(p_fastest_combo, 0)),
        coalesce(p_tutorial_seen, false),
        p_tutorial_seen_at,
        p_tutorial_version,
        p_discord_id
    );

    return jsonb_build_object('ok', true);
exception
    when others then
        return jsonb_build_object('ok', false, 'reason', 'rpc_exception', 'detail', left(sqlerrm, 240));
end;
$$;

create or replace function public.upsert_profile_meta_guarded_bound(
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
begin
    if trim(coalesce(p_username, '')) = '' then
        return jsonb_build_object('ok', false, 'reason', 'missing_username');
    end if;
    if trim(coalesce(p_discord_id, '')) = '' then
        return jsonb_build_object('ok', false, 'reason', 'missing_discord_id');
    end if;
    if not public.identity_can_upsert_profile(p_username, p_discord_id) then
        return jsonb_build_object('ok', false, 'reason', 'identity_mismatch');
    end if;

    perform public.upsert_profile_meta_guarded(
        p_username,
        p_tutorial_seen,
        p_tutorial_seen_at,
        p_tutorial_version,
        coalesce(p_mastery, '{}'::jsonb),
        p_quests,
        p_discord_id
    );

    return jsonb_build_object('ok', true);
exception
    when others then
        return jsonb_build_object('ok', false, 'reason', 'rpc_exception', 'detail', left(sqlerrm, 240));
end;
$$;

create or replace function public.bind_profile_identity_bound(
    p_username text,
    p_discord_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_username text := lower(trim(coalesce(p_username, '')));
    v_discord_id text := trim(coalesce(p_discord_id, ''));
begin
    if v_username = '' then
        return jsonb_build_object('ok', false, 'reason', 'missing_username');
    end if;
    if v_discord_id = '' then
        return jsonb_build_object('ok', false, 'reason', 'missing_discord_id');
    end if;

    if exists (
        select 1
        from public.profiles p
        where coalesce(p.discord_id, '') = v_discord_id
          and lower(p.username) <> v_username
    ) then
        return jsonb_build_object('ok', false, 'reason', 'identity_mismatch');
    end if;

    update public.profiles p
    set discord_id = v_discord_id,
        updated_at = now()
    where lower(p.username) = v_username
      and (coalesce(p.discord_id, '') = '' or coalesce(p.discord_id, '') = v_discord_id);

    if found then
        return jsonb_build_object('ok', true, 'bound', true);
    end if;

    return jsonb_build_object('ok', false, 'reason', 'profile_missing');
exception
    when others then
        return jsonb_build_object('ok', false, 'reason', 'rpc_exception', 'detail', left(sqlerrm, 240));
end;
$$;

create or replace function public.get_profile_settings_bound(
    p_username text,
    p_discord_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_settings jsonb;
begin
    if trim(coalesce(p_username, '')) = '' then
        return jsonb_build_object('ok', false, 'reason', 'missing_username');
    end if;
    if trim(coalesce(p_discord_id, '')) = '' then
        return jsonb_build_object('ok', false, 'reason', 'missing_discord_id');
    end if;
    if not public.identity_match_username_discord(p_username, p_discord_id) then
        return jsonb_build_object('ok', false, 'reason', 'identity_mismatch');
    end if;

    select coalesce(p.user_settings, '{}'::jsonb)
    into v_settings
    from public.profiles p
    where lower(p.username) = lower(trim(p_username))
      and coalesce(p.discord_id, '') = trim(p_discord_id)
    limit 1;

    if not found then
        return jsonb_build_object('ok', false, 'reason', 'profile_missing');
    end if;

    return jsonb_build_object(
        'ok', true,
        'settings', coalesce(v_settings, '{}'::jsonb)
    );
exception
    when others then
        return jsonb_build_object('ok', false, 'reason', 'rpc_exception', 'detail', left(sqlerrm, 240));
end;
$$;

create or replace function public.upsert_profile_settings_bound(
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
    v_settings jsonb := coalesce(p_user_settings, '{}'::jsonb);
begin
    if trim(coalesce(p_username, '')) = '' then
        return jsonb_build_object('ok', false, 'reason', 'missing_username');
    end if;
    if trim(coalesce(p_discord_id, '')) = '' then
        return jsonb_build_object('ok', false, 'reason', 'missing_discord_id');
    end if;
    if not public.identity_can_upsert_profile(p_username, p_discord_id) then
        return jsonb_build_object('ok', false, 'reason', 'identity_mismatch');
    end if;

    update public.profiles p
    set user_settings = v_settings,
        discord_id = coalesce(nullif(p.discord_id, ''), trim(p_discord_id)),
        updated_at = now()
    where lower(p.username) = lower(trim(p_username))
      and (
            coalesce(p.discord_id, '') = ''
            or coalesce(p.discord_id, '') = trim(p_discord_id)
          );

    if found then
        return jsonb_build_object('ok', true);
    end if;

    insert into public.profiles (username, discord_id, user_settings, updated_at)
    values (
        trim(p_username),
        trim(p_discord_id),
        v_settings,
        now()
    )
    on conflict (username) do update
    set user_settings = excluded.user_settings,
        discord_id = coalesce(nullif(profiles.discord_id, ''), excluded.discord_id),
        updated_at = now()
    where (
        coalesce(profiles.discord_id, '') = ''
        or coalesce(profiles.discord_id, '') = excluded.discord_id
    );

    if found then
        return jsonb_build_object('ok', true);
    end if;
    return jsonb_build_object('ok', false, 'reason', 'identity_mismatch');
exception
    when others then
        return jsonb_build_object('ok', false, 'reason', 'rpc_exception', 'detail', left(sqlerrm, 240));
end;
$$;

create or replace function public.get_calibration_profile_bound(
    p_username text,
    p_discord_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_profile jsonb;
begin
    if trim(coalesce(p_username, '')) = '' then
        return jsonb_build_object('ok', false, 'reason', 'missing_username');
    end if;
    if trim(coalesce(p_discord_id, '')) = '' then
        return jsonb_build_object('ok', false, 'reason', 'missing_discord_id');
    end if;
    if not public.identity_match_username_discord(p_username, p_discord_id) then
        return jsonb_build_object('ok', false, 'reason', 'identity_mismatch');
    end if;

    select coalesce(p.calibration_profile, '{}'::jsonb)
    into v_profile
    from public.profiles p
    where lower(p.username) = lower(trim(p_username))
      and coalesce(p.discord_id, '') = trim(p_discord_id)
    limit 1;

    if not found then
        return jsonb_build_object('ok', false, 'reason', 'profile_missing');
    end if;

    return jsonb_build_object(
        'ok', true,
        'calibration_profile', coalesce(v_profile, '{}'::jsonb)
    );
exception
    when others then
        return jsonb_build_object('ok', false, 'reason', 'rpc_exception', 'detail', left(sqlerrm, 240));
end;
$$;

create or replace function public.upsert_calibration_profile_bound(
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
    v_profile jsonb := coalesce(p_calibration_profile, '{}'::jsonb);
begin
    if trim(coalesce(p_username, '')) = '' then
        return jsonb_build_object('ok', false, 'reason', 'missing_username');
    end if;
    if trim(coalesce(p_discord_id, '')) = '' then
        return jsonb_build_object('ok', false, 'reason', 'missing_discord_id');
    end if;
    if not public.identity_can_upsert_profile(p_username, p_discord_id) then
        return jsonb_build_object('ok', false, 'reason', 'identity_mismatch');
    end if;

    update public.profiles p
    set calibration_profile = v_profile,
        discord_id = coalesce(nullif(p.discord_id, ''), trim(p_discord_id)),
        updated_at = now()
    where lower(p.username) = lower(trim(p_username))
      and (
            coalesce(p.discord_id, '') = ''
            or coalesce(p.discord_id, '') = trim(p_discord_id)
          );

    if found then
        return jsonb_build_object('ok', true);
    end if;

    insert into public.profiles (username, discord_id, calibration_profile, updated_at)
    values (
        trim(p_username),
        trim(p_discord_id),
        v_profile,
        now()
    )
    on conflict (username) do update
    set calibration_profile = excluded.calibration_profile,
        discord_id = coalesce(nullif(profiles.discord_id, ''), excluded.discord_id),
        updated_at = now()
    where (
        coalesce(profiles.discord_id, '') = ''
        or coalesce(profiles.discord_id, '') = excluded.discord_id
    );

    if found then
        return jsonb_build_object('ok', true);
    end if;
    return jsonb_build_object('ok', false, 'reason', 'identity_mismatch');
exception
    when others then
        return jsonb_build_object('ok', false, 'reason', 'rpc_exception', 'detail', left(sqlerrm, 240));
end;
$$;

grant execute on function public.issue_run_token_bound(text, text, text, text) to anon, authenticated;
grant execute on function public.submit_challenge_run_secure_bound(text, text, text, numeric, text, jsonb, text, jsonb, text) to anon, authenticated;
grant execute on function public.get_competitive_state_authoritative_bound(text, text) to anon, authenticated;
grant execute on function public.award_jutsu_completion_authoritative_bound(text, text, integer, integer, boolean, text) to anon, authenticated;
grant execute on function public.claim_quest_authoritative_bound(text, text, text, text) to anon, authenticated;
grant execute on function public.upsert_profile_guarded_bound(text, text, integer, integer, text, integer, integer, integer, boolean, timestamptz, text) to anon, authenticated;
grant execute on function public.upsert_profile_meta_guarded_bound(text, text, boolean, timestamptz, text, jsonb, jsonb) to anon, authenticated;
grant execute on function public.bind_profile_identity_bound(text, text) to anon, authenticated;
grant execute on function public.get_profile_settings_bound(text, text) to anon, authenticated;
grant execute on function public.upsert_profile_settings_bound(text, text, jsonb) to anon, authenticated;
grant execute on function public.get_calibration_profile_bound(text, text) to anon, authenticated;
grant execute on function public.upsert_calibration_profile_bound(text, text, jsonb) to anon, authenticated;

-- Remove client execute rights from legacy username-only RPCs.
revoke execute on function public.issue_run_token(text, text, text) from anon, authenticated;
revoke execute on function public.submit_challenge_run_secure(text, text, numeric, text, jsonb, text, jsonb, text, text) from anon, authenticated;
revoke execute on function public.get_competitive_state_authoritative(text) from anon, authenticated;
revoke execute on function public.award_jutsu_completion_authoritative(text, integer, integer, boolean, text) from anon, authenticated;
revoke execute on function public.claim_quest_authoritative(text, text, text) from anon, authenticated;
revoke execute on function public.upsert_profile_guarded(text, integer, integer, text, integer, integer, integer, boolean, timestamptz, text, text) from anon, authenticated;
revoke execute on function public.upsert_profile_meta_guarded(text, boolean, timestamptz, text, jsonb, jsonb, text) from anon, authenticated;

-- Lock direct writes from client roles; only guarded RPCs should mutate these tables.
revoke insert, update, delete on table public.profiles from anon, authenticated;
revoke insert, update, delete on table public.leaderboard from anon, authenticated;
revoke insert, update, delete on table public.quest_claims from anon, authenticated;
revoke insert, update, delete on table public.challenge_run_tokens from anon, authenticated;
revoke insert, update, delete on table public.challenge_run_audit from anon, authenticated;

alter table if exists public.profiles enable row level security;
alter table if exists public.leaderboard enable row level security;
alter table if exists public.quest_claims enable row level security;
alter table if exists public.challenge_run_tokens enable row level security;
alter table if exists public.challenge_run_audit enable row level security;

commit;
