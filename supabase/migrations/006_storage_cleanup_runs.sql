-- Persist media cleanup worker summaries for admin review.

create table if not exists public.storage_cleanup_runs (
  id uuid primary key default gen_random_uuid(),
  scanned integer not null default 0,
  deleted integer not null default 0,
  skipped integer not null default 0,
  errors jsonb not null default '[]'::jsonb,
  skipped_reasons jsonb not null default '{}'::jsonb,
  deleted_files jsonb not null default '[]'::jsonb,
  ran_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint storage_cleanup_runs_counts_nonnegative check (
    scanned >= 0 and deleted >= 0 and skipped >= 0
  ),
  constraint storage_cleanup_runs_errors_array check (jsonb_typeof(errors) = 'array'),
  constraint storage_cleanup_runs_skipped_reasons_object check (
    jsonb_typeof(skipped_reasons) = 'object'
  ),
  constraint storage_cleanup_runs_deleted_files_array check (
    jsonb_typeof(deleted_files) = 'array'
  )
);

create index if not exists storage_cleanup_runs_ran_at_idx
  on public.storage_cleanup_runs (ran_at desc);

alter table public.storage_cleanup_runs enable row level security;

drop policy if exists "storage cleanup runs are readable by admins"
  on public.storage_cleanup_runs;

create policy "storage cleanup runs are readable by admins"
on public.storage_cleanup_runs
for select
to authenticated
using (public.is_admin());

grant select on public.storage_cleanup_runs to authenticated;
grant all on public.storage_cleanup_runs to service_role;
