begin;

-- Phase 2 hardening:
-- 1) lock direct reads on public.profiles to authenticated owner-only
-- 2) expose a safe public projection for level leaderboard
-- 3) provide auth-bound profile meta RPC for web client bootstrap

-- ----------------------------------------------------------------------------
-- Safe public leaderboard projection
-- ----------------------------------------------------------------------------
create or replace view public.profiles_leaderboard_public as
select
  p.id,
  p.username,
  coalesce(p.xp, 0)::bigint as xp,
  coalesce(p.level, 0)::integer as level,
  coalesce(p.rank, 'Academy Student')::text as rank
from public.profiles p;

grant select on public.profiles_leaderboard_public to anon, authenticated;

-- ----------------------------------------------------------------------------
-- profiles table lockdown
-- ----------------------------------------------------------------------------
alter table if exists public.profiles
  add column if not exists auth_user_id uuid;

create unique index if not exists profiles_auth_user_id_uidx
  on public.profiles(auth_user_id)
  where auth_user_id is not null;

alter table if exists public.profiles enable row level security;

drop policy if exists "profiles_public_read" on public.profiles;
drop policy if exists "profiles_read" on public.profiles;
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

-- Keep table grants minimal; service_role remains operational.
revoke all on table public.profiles from public, anon;
grant select on table public.profiles to authenticated;

-- ----------------------------------------------------------------------------
-- Auth-bound profile meta fetch (replaces direct table read from web client)
-- ----------------------------------------------------------------------------
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

revoke all on function public.get_profile_meta_self_auth() from public, anon;
grant execute on function public.get_profile_meta_self_auth() to authenticated, service_role;

commit;
