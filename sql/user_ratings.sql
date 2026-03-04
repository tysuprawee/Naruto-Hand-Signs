begin;

create table if not exists public.user_ratings (
  id bigserial primary key,
  stars smallint not null,
  comment text not null default '',
  run_mode text null,
  jutsu_name text null,
  elapsed_seconds numeric(10, 4) null,
  app_version text null,
  username text null,
  discord_id text null,
  prompt_context jsonb not null default '{}'::jsonb,
  auth_user_id uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint user_ratings_stars_chk
    check (stars between 1 and 5),
  constraint user_ratings_comment_len_chk
    check (char_length(coalesce(comment, '')) <= 600),
  constraint user_ratings_run_mode_chk
    check (run_mode is null or run_mode in ('free', 'rank')),
  constraint user_ratings_jutsu_len_chk
    check (coalesce(length(jutsu_name), 0) <= 80),
  constraint user_ratings_app_version_len_chk
    check (coalesce(length(app_version), 0) <= 32),
  constraint user_ratings_username_len_chk
    check (coalesce(length(username), 0) <= 64),
  constraint user_ratings_discord_id_len_chk
    check (coalesce(length(discord_id), 0) <= 80),
  constraint user_ratings_elapsed_chk
    check (elapsed_seconds is null or (elapsed_seconds >= 0 and elapsed_seconds <= 900))
);

create index if not exists user_ratings_created_at_idx
  on public.user_ratings (created_at desc);

create index if not exists user_ratings_stars_idx
  on public.user_ratings (stars);

create index if not exists user_ratings_auth_user_id_idx
  on public.user_ratings (auth_user_id);

alter table if exists public.user_ratings enable row level security;

drop policy if exists user_ratings_insert_authenticated on public.user_ratings;
create policy user_ratings_insert_authenticated
  on public.user_ratings
  for insert
  to authenticated
  with check (
    auth.uid() is not null
    and auth_user_id = auth.uid()
    and stars between 1 and 5
    and char_length(coalesce(comment, '')) <= 600
  );

drop policy if exists user_ratings_select_none on public.user_ratings;
create policy user_ratings_select_none
  on public.user_ratings
  for select
  to anon, authenticated
  using (false);

commit;
