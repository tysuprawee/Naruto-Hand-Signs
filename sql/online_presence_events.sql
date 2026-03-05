begin;

alter table if exists public.profiles
  add column if not exists auth_user_id uuid;

create table if not exists public.profile_presence_events (
  id bigserial primary key,
  profile_id uuid not null,
  auth_user_id uuid null,
  username text null,
  discord_id text null,
  seen_at timestamptz not null default now(),
  source text not null default 'profile_updated',
  constraint profile_presence_events_username_len_chk
    check (coalesce(length(username), 0) <= 64),
  constraint profile_presence_events_discord_id_len_chk
    check (coalesce(length(discord_id), 0) <= 80),
  constraint profile_presence_events_source_len_chk
    check (coalesce(length(source), 0) <= 32)
);

create index if not exists profile_presence_events_seen_at_idx
  on public.profile_presence_events (seen_at desc);

create index if not exists profile_presence_events_profile_seen_idx
  on public.profile_presence_events (profile_id, seen_at desc);

create index if not exists profile_presence_events_auth_seen_idx
  on public.profile_presence_events (auth_user_id, seen_at desc)
  where auth_user_id is not null;

revoke all on table public.profile_presence_events from public, anon, authenticated;
alter table public.profile_presence_events enable row level security;

drop policy if exists profile_presence_events_select_none on public.profile_presence_events;
create policy profile_presence_events_select_none
  on public.profile_presence_events
  for select
  to anon, authenticated
  using (false);

create or replace function public.log_profile_presence_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.profile_presence_events (
      profile_id,
      auth_user_id,
      username,
      discord_id,
      seen_at,
      source
    )
    values (
      new.id,
      new.auth_user_id,
      nullif(trim(coalesce(new.username, '')), ''),
      nullif(trim(coalesce(new.discord_id, '')), ''),
      coalesce(new.updated_at, now()),
      'profile_insert'
    );
  elsif new.updated_at is distinct from old.updated_at then
    insert into public.profile_presence_events (
      profile_id,
      auth_user_id,
      username,
      discord_id,
      seen_at,
      source
    )
    values (
      new.id,
      new.auth_user_id,
      nullif(trim(coalesce(new.username, '')), ''),
      nullif(trim(coalesce(new.discord_id, '')), ''),
      coalesce(new.updated_at, now()),
      'profile_update'
    );
  end if;
  return new;
exception
  when others then
    -- Never block profile writes because of telemetry logging failures.
    return new;
end;
$$;

revoke all on function public.log_profile_presence_event() from public;

drop trigger if exists trg_profiles_presence_event on public.profiles;
create trigger trg_profiles_presence_event
after insert or update of updated_at on public.profiles
for each row
execute function public.log_profile_presence_event();

-- One-time seed so peak calculations have at least today's latest heartbeat per profile.
insert into public.profile_presence_events (
  profile_id,
  auth_user_id,
  username,
  discord_id,
  seen_at,
  source
)
select
  p.id,
  p.auth_user_id,
  nullif(trim(coalesce(p.username, '')), ''),
  nullif(trim(coalesce(p.discord_id, '')), ''),
  p.updated_at,
  'seed_existing'
from public.profiles p
where p.updated_at is not null
  and p.updated_at >= date_trunc('day', now())
  and not exists (
    select 1
    from public.profile_presence_events e
    where e.profile_id = p.id
      and e.seen_at = p.updated_at
      and e.source = 'seed_existing'
  );

commit;
