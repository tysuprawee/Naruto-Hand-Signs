begin;

create table if not exists public.user_reports (
  id bigserial primary key,
  report_text text not null,
  page_path text null,
  user_agent text null,
  auth_user_id uuid null,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  constraint user_reports_text_len_chk
    check (char_length(trim(coalesce(report_text, ''))) between 5 and 1000),
  constraint user_reports_status_chk
    check (status in ('new', 'reviewing', 'resolved', 'spam'))
);

create index if not exists user_reports_created_at_idx
  on public.user_reports (created_at desc);

create index if not exists user_reports_status_idx
  on public.user_reports (status);

create index if not exists user_reports_auth_user_id_idx
  on public.user_reports (auth_user_id);

alter table if exists public.user_reports enable row level security;

drop policy if exists user_reports_insert_public on public.user_reports;
create policy user_reports_insert_public
  on public.user_reports
  for insert
  to anon, authenticated
  with check (
    char_length(trim(coalesce(report_text, ''))) between 5 and 1000
    and coalesce(length(page_path), 0) <= 256
    and coalesce(length(user_agent), 0) <= 1024
  );

drop policy if exists user_reports_select_none on public.user_reports;
create policy user_reports_select_none
  on public.user_reports
  for select
  to anon, authenticated
  using (false);

commit;

