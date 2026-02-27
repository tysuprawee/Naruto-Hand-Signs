begin;

-- Server-authoritative quest streaks.
-- - Reconciles streak from authoritative daily/weekly quest state.
-- - Persists streak in profiles.quests.
-- - Prevents web meta-sync from mutating quests via client payload.

create or replace function public.quest_jsonb_int(
  p_data jsonb,
  p_path text[],
  p_default integer default 0
)
returns integer
language plpgsql
immutable
as $$
declare
  v_text text;
  v_value integer;
begin
  if p_data is null then
    return coalesce(p_default, 0);
  end if;

  v_text := trim(coalesce(p_data #>> p_path, ''));
  if v_text = '' then
    return coalesce(p_default, 0);
  end if;

  if v_text ~ '^-?\d+$' then
    return v_text::integer;
  end if;

  if v_text ~ '^-?\d+(\.\d+)?$' then
    v_value := floor(v_text::numeric)::integer;
    return v_value;
  end if;

  return coalesce(p_default, 0);
exception
  when others then
    return coalesce(p_default, 0);
end;
$$;

create or replace function public.quest_jsonb_bool(
  p_data jsonb,
  p_path text[],
  p_default boolean default false
)
returns boolean
language plpgsql
immutable
as $$
declare
  v_text text;
begin
  if p_data is null then
    return coalesce(p_default, false);
  end if;

  v_text := lower(trim(coalesce(p_data #>> p_path, '')));
  if v_text = '' then
    return coalesce(p_default, false);
  end if;

  if v_text in ('1', 't', 'true', 'y', 'yes', 'on') then
    return true;
  end if;

  if v_text in ('0', 'f', 'false', 'n', 'no', 'off') then
    return false;
  end if;

  return coalesce(p_default, false);
exception
  when others then
    return coalesce(p_default, false);
end;
$$;

create or replace function public.quest_daily_period_to_date(
  p_period text
)
returns date
language plpgsql
immutable
as $$
declare
  v_period text := trim(coalesce(p_period, ''));
  v_date date;
begin
  if v_period !~ '^\d{4}-\d{2}-\d{2}$' then
    return null;
  end if;

  v_date := to_date(v_period, 'YYYY-MM-DD');
  if to_char(v_date, 'YYYY-MM-DD') <> v_period then
    return null;
  end if;

  return v_date;
exception
  when others then
    return null;
end;
$$;

create or replace function public.quest_iso_week_period_to_monday(
  p_period text
)
returns date
language plpgsql
immutable
as $$
declare
  v_period text := trim(coalesce(p_period, ''));
  v_match text[];
  v_year integer;
  v_week integer;
  v_jan4 date;
  v_monday_week1 date;
  v_target date;
begin
  if v_period !~ '^\d{4}-W\d{2}$' then
    return null;
  end if;

  v_match := regexp_match(v_period, '^(\d{4})-W(\d{2})$');
  if v_match is null then
    return null;
  end if;

  v_year := v_match[1]::integer;
  v_week := v_match[2]::integer;

  if v_week < 1 or v_week > 53 then
    return null;
  end if;

  v_jan4 := make_date(v_year, 1, 4);
  v_monday_week1 := v_jan4 - (extract(isodow from v_jan4)::integer - 1);
  v_target := v_monday_week1 + ((v_week - 1) * 7);

  if to_char(v_target, 'IYYY-"W"IW') <> v_period then
    return null;
  end if;

  return v_target;
exception
  when others then
    return null;
end;
$$;

create or replace function public.quest_days_between_daily_periods(
  p_from text,
  p_to text
)
returns integer
language plpgsql
immutable
as $$
declare
  v_from date := public.quest_daily_period_to_date(p_from);
  v_to date := public.quest_daily_period_to_date(p_to);
begin
  if v_from is null or v_to is null then
    return null;
  end if;
  return (v_to - v_from)::integer;
end;
$$;

create or replace function public.quest_weeks_between_iso_periods(
  p_from text,
  p_to text
)
returns integer
language plpgsql
immutable
as $$
declare
  v_from date := public.quest_iso_week_period_to_monday(p_from);
  v_to date := public.quest_iso_week_period_to_monday(p_to);
begin
  if v_from is null or v_to is null then
    return null;
  end if;
  return floor(((v_to - v_from)::numeric) / 7)::integer;
end;
$$;

create or replace function public.quest_reconcile_streak(
  p_quests jsonb
)
returns jsonb
language plpgsql
stable
as $$
declare
  v_quests jsonb := coalesce(p_quests, '{}'::jsonb);
  v_daily jsonb;
  v_weekly jsonb;
  v_streak jsonb;

  v_daily_period text;
  v_weekly_period text;

  v_daily_current integer;
  v_daily_best integer;
  v_daily_last_period text;

  v_weekly_current integer;
  v_weekly_best integer;
  v_weekly_last_period text;

  v_daily_complete boolean;
  v_weekly_complete boolean;

  v_daily_gap integer;
  v_weekly_gap integer;
begin
  if jsonb_typeof(v_quests) <> 'object' then
    return coalesce(p_quests, '{}'::jsonb);
  end if;

  v_daily := coalesce(v_quests->'daily', '{}'::jsonb);
  v_weekly := coalesce(v_quests->'weekly', '{}'::jsonb);

  if jsonb_typeof(v_daily) <> 'object' or jsonb_typeof(v_weekly) <> 'object' then
    return v_quests;
  end if;

  v_streak := coalesce(v_quests->'streak', '{}'::jsonb);

  v_daily_period := trim(coalesce(v_daily->>'period', ''));
  v_weekly_period := trim(coalesce(v_weekly->>'period', ''));

  v_daily_current := greatest(0, public.quest_jsonb_int(v_streak, array['dailyCurrent'], 0));
  v_daily_best := greatest(0, public.quest_jsonb_int(v_streak, array['dailyBest'], 0));
  v_daily_last_period := trim(coalesce(v_streak->>'dailyLastPeriod', ''));

  v_weekly_current := greatest(0, public.quest_jsonb_int(v_streak, array['weeklyCurrent'], 0));
  v_weekly_best := greatest(0, public.quest_jsonb_int(v_streak, array['weeklyBest'], 0));
  v_weekly_last_period := trim(coalesce(v_streak->>'weeklyLastPeriod', ''));

  v_daily_complete := (
    public.quest_jsonb_bool(v_daily, array['quests', 'd_signs', 'claimed'], false)
    or public.quest_jsonb_int(v_daily, array['quests', 'd_signs', 'progress'], 0) >= 25
  )
  and (
    public.quest_jsonb_bool(v_daily, array['quests', 'd_jutsus', 'claimed'], false)
    or public.quest_jsonb_int(v_daily, array['quests', 'd_jutsus', 'progress'], 0) >= 5
  )
  and (
    public.quest_jsonb_bool(v_daily, array['quests', 'd_xp', 'claimed'], false)
    or public.quest_jsonb_int(v_daily, array['quests', 'd_xp', 'progress'], 0) >= 450
  );

  v_weekly_complete := (
    public.quest_jsonb_bool(v_weekly, array['quests', 'w_jutsus', 'claimed'], false)
    or public.quest_jsonb_int(v_weekly, array['quests', 'w_jutsus', 'progress'], 0) >= 30
  )
  and (
    public.quest_jsonb_bool(v_weekly, array['quests', 'w_challenges', 'claimed'], false)
    or public.quest_jsonb_int(v_weekly, array['quests', 'w_challenges', 'progress'], 0) >= 12
  )
  and (
    public.quest_jsonb_bool(v_weekly, array['quests', 'w_xp', 'claimed'], false)
    or public.quest_jsonb_int(v_weekly, array['quests', 'w_xp', 'progress'], 0) >= 4000
  );

  if v_daily_last_period <> '' and v_daily_period <> '' and v_daily_last_period <> v_daily_period then
    v_daily_gap := public.quest_days_between_daily_periods(v_daily_last_period, v_daily_period);
    if v_daily_gap is not null and v_daily_gap > 1 then
      v_daily_current := 0;
    end if;
  end if;

  if v_daily_complete and v_daily_period <> '' and v_daily_last_period <> v_daily_period then
    v_daily_gap := public.quest_days_between_daily_periods(v_daily_last_period, v_daily_period);
    if v_daily_last_period = '' then
      v_daily_current := 1;
    elsif v_daily_gap = 1 then
      v_daily_current := greatest(1, v_daily_current + 1);
    else
      v_daily_current := 1;
    end if;
    v_daily_best := greatest(v_daily_best, v_daily_current);
    v_daily_last_period := v_daily_period;
  end if;

  if v_weekly_last_period <> '' and v_weekly_period <> '' and v_weekly_last_period <> v_weekly_period then
    v_weekly_gap := public.quest_weeks_between_iso_periods(v_weekly_last_period, v_weekly_period);
    if v_weekly_gap is not null and v_weekly_gap > 1 then
      v_weekly_current := 0;
    end if;
  end if;

  if v_weekly_complete and v_weekly_period <> '' and v_weekly_last_period <> v_weekly_period then
    v_weekly_gap := public.quest_weeks_between_iso_periods(v_weekly_last_period, v_weekly_period);
    if v_weekly_last_period = '' then
      v_weekly_current := 1;
    elsif v_weekly_gap = 1 then
      v_weekly_current := greatest(1, v_weekly_current + 1);
    else
      v_weekly_current := 1;
    end if;
    v_weekly_best := greatest(v_weekly_best, v_weekly_current);
    v_weekly_last_period := v_weekly_period;
  end if;

  v_streak := jsonb_build_object(
    'dailyCurrent', greatest(0, v_daily_current),
    'dailyBest', greatest(0, v_daily_best),
    'dailyLastPeriod', coalesce(v_daily_last_period, ''),
    'weeklyCurrent', greatest(0, v_weekly_current),
    'weeklyBest', greatest(0, v_weekly_best),
    'weeklyLastPeriod', coalesce(v_weekly_last_period, '')
  );

  v_quests := jsonb_set(v_quests, '{streak}', v_streak, true);
  return v_quests;
end;
$$;

create or replace function public.quest_streak_bonus_pct(
  p_daily_current integer,
  p_weekly_current integer
)
returns integer
language plpgsql
immutable
as $$
declare
  v_daily integer := greatest(0, coalesce(p_daily_current, 0));
  v_weekly integer := greatest(0, coalesce(p_weekly_current, 0));
  v_daily_bonus integer := 0;
  v_weekly_bonus integer := 0;
begin
  if v_daily >= 14 then
    v_daily_bonus := 15;
  elsif v_daily >= 7 then
    v_daily_bonus := 10;
  elsif v_daily >= 3 then
    v_daily_bonus := 5;
  end if;

  if v_weekly >= 8 then
    v_weekly_bonus := 15;
  elsif v_weekly >= 4 then
    v_weekly_bonus := 10;
  elsif v_weekly >= 2 then
    v_weekly_bonus := 5;
  end if;

  return least(40, v_daily_bonus + v_weekly_bonus);
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
    v_profile jsonb;
    v_quests jsonb;
    v_username_key text := lower(trim(coalesce(p_username, '')));
    v_discord_key text := trim(coalesce(p_discord_id, ''));
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
        v_profile := case when jsonb_typeof(v_result->'profile') = 'object' then v_result->'profile' else '{}'::jsonb end;
        v_quests := case
          when jsonb_typeof(v_profile->'quests') = 'object' then v_profile->'quests'
          when jsonb_typeof(v_result->'quests') = 'object' then v_result->'quests'
          else null
        end;

        if v_quests is not null
           and jsonb_typeof(v_quests->'daily') = 'object'
           and jsonb_typeof(v_quests->'weekly') = 'object' then
          v_quests := public.quest_reconcile_streak(v_quests);

          update public.profiles p
          set quests = v_quests,
              updated_at = now()
          where lower(p.username) = v_username_key
            and coalesce(p.discord_id, '') = v_discord_key;

          if jsonb_typeof(v_result->'profile') = 'object' then
            v_result := jsonb_set(v_result, '{profile,quests}', v_quests, true);
          else
            v_result := v_result || jsonb_build_object('profile', jsonb_build_object('quests', v_quests));
          end if;
          v_result := jsonb_set(v_result, '{quests}', v_quests, true);
        end if;

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
    v_profile jsonb;
    v_quests jsonb;
    v_profile_quests jsonb;
    v_reconciled_before jsonb;
    v_daily_current integer := 0;
    v_weekly_current integer := 0;
    v_bonus_pct integer := 0;
    v_base_xp integer := 0;
    v_effective_xp integer := 0;
    v_bonus_xp integer := 0;
    v_username_key text := lower(trim(coalesce(p_username, '')));
    v_discord_key text := trim(coalesce(p_discord_id, ''));
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

    v_base_xp := greatest(0, coalesce(p_xp_gain, 0));
    v_effective_xp := v_base_xp;

    select p.quests
    into v_profile_quests
    from public.profiles p
    where lower(p.username) = v_username_key
      and coalesce(p.discord_id, '') = v_discord_key
    limit 1;

    if v_profile_quests is not null
       and jsonb_typeof(v_profile_quests->'daily') = 'object'
       and jsonb_typeof(v_profile_quests->'weekly') = 'object' then
      v_reconciled_before := public.quest_reconcile_streak(v_profile_quests);
      v_daily_current := public.quest_jsonb_int(v_reconciled_before, array['streak', 'dailyCurrent'], 0);
      v_weekly_current := public.quest_jsonb_int(v_reconciled_before, array['streak', 'weeklyCurrent'], 0);
      v_bonus_pct := public.quest_streak_bonus_pct(v_daily_current, v_weekly_current);
    end if;

    if v_bonus_pct > 0 and v_base_xp > 0 then
      v_effective_xp := greatest(
        v_base_xp,
        ceil((v_base_xp::numeric * (100 + v_bonus_pct)::numeric) / 100)::integer
      );
    end if;
    v_bonus_xp := greatest(0, v_effective_xp - v_base_xp);

    select to_jsonb(x)
    into v_result
    from public.award_jutsu_completion_authoritative(
        p_username,
        v_effective_xp,
        greatest(0, coalesce(p_signs_landed, 0)),
        coalesce(p_is_challenge, false),
        coalesce(p_mode, '')
    ) as x
    limit 1;

    if v_result is null then
        return jsonb_build_object('ok', false, 'reason', 'award_failed');
    end if;

    if jsonb_typeof(v_result) = 'object' then
        v_profile := case when jsonb_typeof(v_result->'profile') = 'object' then v_result->'profile' else '{}'::jsonb end;
        v_quests := case
          when jsonb_typeof(v_profile->'quests') = 'object' then v_profile->'quests'
          when jsonb_typeof(v_result->'quests') = 'object' then v_result->'quests'
          else null
        end;

        if v_quests is not null
           and jsonb_typeof(v_quests->'daily') = 'object'
           and jsonb_typeof(v_quests->'weekly') = 'object' then
          v_quests := public.quest_reconcile_streak(v_quests);

          update public.profiles p
          set quests = v_quests,
              updated_at = now()
          where lower(p.username) = v_username_key
            and coalesce(p.discord_id, '') = v_discord_key;

          if jsonb_typeof(v_result->'profile') = 'object' then
            v_result := jsonb_set(v_result, '{profile,quests}', v_quests, true);
          else
            v_result := v_result || jsonb_build_object('profile', jsonb_build_object('quests', v_quests));
          end if;
          v_result := jsonb_set(v_result, '{quests}', v_quests, true);
        end if;

        v_result := v_result || jsonb_build_object(
          'streak_bonus_pct', greatest(0, v_bonus_pct),
          'streak_bonus_xp', greatest(0, v_bonus_xp),
          'streak_daily', greatest(0, v_daily_current),
          'streak_weekly', greatest(0, v_weekly_current)
        );

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
    v_profile jsonb;
    v_quests jsonb;
    v_username_key text := lower(trim(coalesce(p_username, '')));
    v_discord_key text := trim(coalesce(p_discord_id, ''));
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
        v_profile := case when jsonb_typeof(v_result->'profile') = 'object' then v_result->'profile' else '{}'::jsonb end;
        v_quests := case
          when jsonb_typeof(v_profile->'quests') = 'object' then v_profile->'quests'
          when jsonb_typeof(v_result->'quests') = 'object' then v_result->'quests'
          else null
        end;

        if v_quests is not null
           and jsonb_typeof(v_quests->'daily') = 'object'
           and jsonb_typeof(v_quests->'weekly') = 'object' then
          v_quests := public.quest_reconcile_streak(v_quests);

          update public.profiles p
          set quests = v_quests,
              updated_at = now()
          where lower(p.username) = v_username_key
            and coalesce(p.discord_id, '') = v_discord_key;

          if jsonb_typeof(v_result->'profile') = 'object' then
            v_result := jsonb_set(v_result, '{profile,quests}', v_quests, true);
          else
            v_result := v_result || jsonb_build_object('profile', jsonb_build_object('quests', v_quests));
          end if;
          v_result := jsonb_set(v_result, '{quests}', v_quests, true);
        end if;

        return v_result;
    end if;

    return jsonb_build_object('ok', true, 'result', v_result);
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
    v_server_quests jsonb;
begin
    v_guard := public.auth_guard_discord_identity(p_username, p_discord_id);
    if coalesce(v_guard->>'ok', 'false') <> 'true' then
        return v_guard;
    end if;

    select p.quests
    into v_server_quests
    from public.profiles p
    where lower(p.username) = lower(trim(v_guard->>'username'))
      and coalesce(p.discord_id, '') = trim(v_guard->>'discord_id')
    limit 1;

    return public.upsert_profile_meta_guarded_bound(
      v_guard->>'username',
      v_guard->>'discord_id',
      p_tutorial_seen,
      p_tutorial_seen_at,
      p_tutorial_version,
      p_mastery,
      v_server_quests
    );
exception
    when others then
        return jsonb_build_object('ok', false, 'reason', 'rpc_exception', 'detail', left(sqlerrm, 240));
end;
$$;

commit;
