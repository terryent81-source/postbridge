alter type public.account_status add value if not exists 'token_missing';

alter table public.social_accounts
  add column if not exists page_category text,
  add column if not exists page_tasks text[] not null default '{}'::text[],
  add column if not exists has_page_access_token boolean not null default false;

create index if not exists social_accounts_has_page_access_token_idx
  on public.social_accounts (has_page_access_token);
