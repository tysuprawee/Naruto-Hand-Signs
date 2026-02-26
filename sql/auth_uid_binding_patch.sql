begin;

-- Bind authenticated web accounts by auth.uid instead of provider-specific IDs.
-- Safe to run multiple times.

alter table if exists public.profiles
  add column if not exists auth_user_id uuid;

create unique index if not exists profiles_auth_user_id_uidx
  on public.profiles(auth_user_id)
  where auth_user_id is not null;

-- Backfill existing Discord-linked profiles to auth_user_id.
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

create or replace function public.get_profile_meta_self_auth()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_discord text := trim(coalesce(public.auth_session_discord_id(), ''));
  v_profile jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  end if;

  if v_discord <> '' then
    update public.profiles p
    set auth_user_id = v_uid,
        updated_at = now()
    where p.auth_user_id is null
      and coalesce(p.discord_id, '') = v_discord;
  end if;

  select to_jsonb(x)
  into v_profile
  from (
    select
      p.username,
      p.discord_id,
      p.mastery,
      p.tutorial_seen,
      p.tutorial_seen_at,
      p.tutorial_version,
      p.quests,
      p.calibration_profile,
      p.xp,
      p.level,
      p.rank,
      p.total_signs,
      p.total_jutsus,
      p.fastest_combo
    from public.profiles p
    where p.auth_user_id = v_uid
       or (
         p.auth_user_id is null
         and v_discord <> ''
         and coalesce(p.discord_id, '') = v_discord
       )
    limit 1
  ) as x;

  if v_profile is null then
    return jsonb_build_object('ok', false, 'reason', 'profile_missing');
  end if;

  return jsonb_build_object('ok', true, 'profile', v_profile);
exception
  when others then
    return jsonb_build_object('ok', false, 'reason', 'rpc_exception', 'detail', left(sqlerrm, 240));
end;
$$;

revoke all on function public.auth_guard_discord_identity(text, text) from public;
grant execute on function public.auth_guard_discord_identity(text, text) to authenticated, service_role;

revoke all on function public.get_profile_meta_self_auth() from public, anon;
grant execute on function public.get_profile_meta_self_auth() to authenticated, service_role;

-- Owner-read policy for profiles.
drop policy if exists "profiles_self_read_authenticated" on public.profiles;
create policy profiles_self_read_authenticated
  on public.profiles
  for select
  to authenticated
  using (
    (
      auth.uid() is not null
      and auth_user_id = auth.uid()
    )
    or (
      auth.uid() is not null
      and auth_user_id is null
      and coalesce(discord_id, '') = coalesce(public.auth_session_discord_id(), '')
    )
  );

-- Owner-read policy for quest_claims.
drop policy if exists "quest_claims_owner_read" on public.quest_claims;
create policy quest_claims_owner_read
  on public.quest_claims
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where lower(p.username) = lower(public.quest_claims.username)
        and (
          (auth.uid() is not null and p.auth_user_id = auth.uid())
          or (
            auth.uid() is not null
            and p.auth_user_id is null
            and coalesce(p.discord_id, '') = coalesce(public.auth_session_discord_id(), '')
          )
        )
    )
  );

commit;
