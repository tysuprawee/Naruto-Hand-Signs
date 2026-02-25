begin;

-- Security Advisor hardening for public schema tables used by web clients.
-- Idempotent: safe to run multiple times.

-- Ensure RLS is enabled on user-facing tables.
alter table if exists public.app_config enable row level security;
alter table if exists public.button_clicks enable row level security;
alter table if exists public.challenge_mode_rules enable row level security;
alter table if exists public.leaderboard enable row level security;
alter table if exists public.profiles enable row level security;
alter table if exists public.quest_claims enable row level security;
alter table if exists public.website_visits enable row level security;

-- ============================================================================
-- app_config: allow only active runtime rows needed by clients
-- ============================================================================
drop policy if exists "Allow public read" on public.app_config;
drop policy if exists "allowpublicselectappconfig" on public.app_config;
drop policy if exists "app_config_public_read_active" on public.app_config;

create policy app_config_public_read_active
  on public.app_config
  for select
  to anon, authenticated
  using (
    is_active = true
    and type in ('announcement', 'version', 'maintenance', 'dataset')
  );

-- ============================================================================
-- button_clicks: public insert only, minimal payload shape checks
-- ============================================================================
drop policy if exists "Enable insert for everyone" on public.button_clicks;
drop policy if exists "allowpublicinsertclicks" on public.button_clicks;
drop policy if exists "Enable select for service role only" on public.button_clicks;
drop policy if exists "button_clicks_public_insert" on public.button_clicks;
drop policy if exists "button_clicks_service_select" on public.button_clicks;

create policy button_clicks_public_insert
  on public.button_clicks
  for insert
  to anon, authenticated
  with check (
    length(coalesce(button_name, '')) between 1 and 64
    and length(coalesce(user_agent, '')) <= 1024
    and length(coalesce(page_path, '')) <= 2048
    and length(coalesce(target_path, '')) <= 2048
  );

create policy button_clicks_service_select
  on public.button_clicks
  for select
  to service_role
  using (true);

-- ============================================================================
-- challenge_mode_rules: keep single public read policy
-- ============================================================================
drop policy if exists "allowpublicselectchallengerules" on public.challenge_mode_rules;
drop policy if exists "challenge_mode_rules_read" on public.challenge_mode_rules;

create policy challenge_mode_rules_read
  on public.challenge_mode_rules
  for select
  to anon, authenticated
  using (true);

-- ============================================================================
-- leaderboard: keep single public read policy
-- ============================================================================
drop policy if exists "leaderboard_public_read" on public.leaderboard;
drop policy if exists "leaderboard_read" on public.leaderboard;

create policy leaderboard_read
  on public.leaderboard
  for select
  to anon, authenticated
  using (true);

-- ============================================================================
-- profiles: keep single read policy for existing app behavior
-- NOTE: this remains broad by design for public leaderboard compatibility.
-- ============================================================================
drop policy if exists "profiles_public_read" on public.profiles;
drop policy if exists "profiles_read" on public.profiles;

create policy profiles_read
  on public.profiles
  for select
  to anon, authenticated
  using (true);

-- ============================================================================
-- quest_claims: restrict authenticated reads to own claims only
-- ============================================================================
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
        and coalesce(p.discord_id, '') = coalesce(public.auth_session_discord_id(), '')
    )
  );

-- ============================================================================
-- website_visits: public insert only, service-role read only
-- ============================================================================
drop policy if exists "Enable insert for everyone" on public.website_visits;
drop policy if exists "allowpublicinsertvisits" on public.website_visits;
drop policy if exists "Enable select for service role only" on public.website_visits;
drop policy if exists "website_visits_public_insert" on public.website_visits;
drop policy if exists "website_visits_service_select" on public.website_visits;

create policy website_visits_public_insert
  on public.website_visits
  for insert
  to anon, authenticated
  with check (
    length(coalesce(page_path, '')) <= 2048
    and length(coalesce(user_agent, '')) <= 1024
    and length(coalesce(referrer, '')) <= 4096
  );

create policy website_visits_service_select
  on public.website_visits
  for select
  to service_role
  using (true);

commit;

