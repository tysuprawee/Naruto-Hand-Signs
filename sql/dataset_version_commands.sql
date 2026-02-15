-- Dataset version management for web challenge CSV caching.
-- This reuses public.app_config (same table used for game version/maintenance).

-- 1) Ensure columns used by version rows exist.
alter table public.app_config add column if not exists url text;
alter table public.app_config add column if not exists checksum text;

-- 2) Optional: speed up reads for active config rows.
create index if not exists idx_app_config_type_active_priority_created
  on public.app_config (type, is_active, priority desc, created_at desc);

-- 3) Optional RLS policy so web anon client can read active app_config rows.
-- Enable only if your project uses RLS on app_config.
-- alter table public.app_config enable row level security;
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'app_config'
      and policyname = 'app_config_public_read_active'
  ) then
    create policy app_config_public_read_active
      on public.app_config
      for select
      to anon, authenticated
      using (is_active = true);
  end if;
end
$$;

-- 4) Promote a new dataset version (run this each time CSV changes).
update public.app_config
set is_active = false
where type = 'dataset';

insert into public.app_config (type, message, version, is_active, priority, created_at, url, checksum)
values (
  'dataset',
  'Web challenge MediaPipe dataset',
  '2026.02.15.1',
  true,
  900,
  now(),
  '/mediapipe_signs_db.csv',
  '<sha256_of_csv>'
);

-- 5) Verify active dataset row.
select type, message, version, is_active, priority, created_at, url, checksum
from public.app_config
where type = 'dataset'
order by is_active desc, priority desc, created_at desc;
