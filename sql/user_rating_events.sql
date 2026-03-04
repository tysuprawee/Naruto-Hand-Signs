begin;

create table if not exists public.user_rating_events (
  id bigserial primary key,
  event_type text not null,
  stars smallint null,
  comment text null,
  suggestion text null,
  run_mode text null,
  jutsu_name text null,
  elapsed_seconds numeric(10, 4) null,
  app_version text null,
  username text null,
  discord_id text null,
  metadata jsonb not null default '{}'::jsonb,
  auth_user_id uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint user_rating_events_event_type_chk
    check (event_type in ('prompt_shown', 'dismiss_not_now', 'dismiss_never', 'submitted')),
  constraint user_rating_events_stars_chk
    check (stars is null or stars between 1 and 5),
  constraint user_rating_events_comment_len_chk
    check (coalesce(length(comment), 0) <= 600),
  constraint user_rating_events_suggestion_len_chk
    check (coalesce(length(suggestion), 0) <= 600),
  constraint user_rating_events_run_mode_chk
    check (run_mode is null or run_mode in ('free', 'rank')),
  constraint user_rating_events_jutsu_len_chk
    check (coalesce(length(jutsu_name), 0) <= 80),
  constraint user_rating_events_app_version_len_chk
    check (coalesce(length(app_version), 0) <= 32),
  constraint user_rating_events_username_len_chk
    check (coalesce(length(username), 0) <= 64),
  constraint user_rating_events_discord_id_len_chk
    check (coalesce(length(discord_id), 0) <= 80),
  constraint user_rating_events_elapsed_chk
    check (elapsed_seconds is null or (elapsed_seconds >= 0 and elapsed_seconds <= 900)),
  constraint user_rating_events_submitted_payload_chk
    check (
      (event_type = 'submitted' and stars is not null)
      or (event_type <> 'submitted' and stars is null)
    )
);

create index if not exists user_rating_events_created_at_idx
  on public.user_rating_events (created_at desc);

create index if not exists user_rating_events_event_type_idx
  on public.user_rating_events (event_type);

create index if not exists user_rating_events_auth_user_id_idx
  on public.user_rating_events (auth_user_id);

alter table if exists public.user_rating_events enable row level security;

drop policy if exists user_rating_events_insert_authenticated on public.user_rating_events;
create policy user_rating_events_insert_authenticated
  on public.user_rating_events
  for insert
  to authenticated
  with check (
    auth.uid() is not null
    and auth_user_id = auth.uid()
    and event_type in ('prompt_shown', 'dismiss_not_now', 'dismiss_never', 'submitted')
    and (stars is null or stars between 1 and 5)
  );

drop policy if exists user_rating_events_select_none on public.user_rating_events;
create policy user_rating_events_select_none
  on public.user_rating_events
  for select
  to anon, authenticated
  using (false);

commit;
