-- First pass for real SNS upload integration.
-- Tokens remain in private.social_account_secrets. Public social_accounts only
-- stores provider resource IDs needed to route publishing jobs.

alter table public.social_accounts
  add column if not exists page_id text,
  add column if not exists instagram_business_account_id text;

create index if not exists social_accounts_page_id_idx
  on public.social_accounts (page_id)
  where page_id is not null;

create index if not exists social_accounts_instagram_business_account_id_idx
  on public.social_accounts (instagram_business_account_id)
  where instagram_business_account_id is not null;

alter table public.upload_logs
  add column if not exists upload_mode text not null default 'mock',
  add column if not exists platform_post_id text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'upload_logs_upload_mode_check'
      and conrelid = 'public.upload_logs'::regclass
  ) then
    alter table public.upload_logs
      add constraint upload_logs_upload_mode_check
      check (upload_mode in ('mock', 'real'));
  end if;
end $$;

create index if not exists upload_logs_upload_mode_idx
  on public.upload_logs (upload_mode);
