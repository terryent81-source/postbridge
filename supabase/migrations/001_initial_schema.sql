-- PostBridge initial Supabase schema.
-- This migration intentionally does not create the Supabase Storage bucket.
-- Assumed bucket name: post-media.
-- Bucket creation and Storage policies should be handled in a separate
-- Storage-specific migration or deployment document.

create extension if not exists pgcrypto;

create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;
grant usage on schema private to service_role;

create type public.platform as enum ('instagram', 'facebook', 'youtube', 'tiktok', 'x');
create type public.post_status as enum ('draft', 'scheduled', 'published', 'failed');
create type public.account_status as enum ('connected', 'needs_connection', 'expired');
create type public.upload_status as enum ('pending', 'success', 'failed');
create type public.subscription_tier as enum ('free', 'starter', 'pro', 'business');
create type public.media_type as enum ('image', 'video');
create type public.media_asset_status as enum (
  'uploading',
  'ready',
  'attached',
  'upload_success',
  'upload_failed',
  'pending_delete',
  'deleted'
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  tier public.subscription_tier not null unique,
  name text not null,
  price_monthly integer not null default 0,
  price_yearly integer not null default 0,
  weekly_upload_limit integer not null,
  features text[] not null default '{}',
  is_default boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index subscription_plans_only_one_default_idx
  on public.subscription_plans (is_default)
  where is_default = true;

insert into public.subscription_plans (
  tier,
  name,
  price_monthly,
  price_yearly,
  weekly_upload_limit,
  features,
  is_default,
  sort_order
) values
  (
    'free',
    'Free',
    0,
    0,
    3,
    array['주 3회 무료 업로드', '5개 플랫폼 지원', '예약 발행 1건', '기본 통계'],
    true,
    0
  ),
  (
    'starter',
    'Starter',
    9900,
    99000,
    30,
    array['월 30회 업로드', '5개 플랫폼 지원', '예약 발행 무제한', '이메일 지원'],
    false,
    1
  ),
  (
    'pro',
    'Pro',
    19900,
    199000,
    200,
    array['월 200회 업로드', '팀원 3명 초대', '고급 통계 + CSV 내보내기', '우선 지원'],
    false,
    2
  ),
  (
    'business',
    'Business',
    49900,
    499000,
    -1,
    array['무제한 업로드', '팀원 무제한', '맞춤형 SLA', '전담 매니저'],
    false,
    3
  );

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  locale text not null default 'ko-KR',
  plan_id uuid not null references public.subscription_plans(id),
  referred_by_user_id uuid references auth.users(id) on delete set null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  content text not null default '',
  platforms public.platform[] not null default '{}',
  status public.post_status not null default 'draft',
  scheduled_at timestamptz,
  published_at timestamptz,
  fail_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint posts_platforms_not_empty check (array_length(platforms, 1) > 0)
);

comment on table public.posts is
  'Post content and scheduling state. media_urls is deprecated in the app model; media files are linked through public.media_assets instead.';

create index posts_user_id_idx on public.posts (user_id);
create index posts_status_idx on public.posts (status);
create index posts_scheduled_at_idx on public.posts (scheduled_at);
create index posts_user_status_scheduled_at_idx on public.posts (user_id, status, scheduled_at);

create trigger set_posts_updated_at
before update on public.posts
for each row execute function public.set_updated_at();

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid references public.posts(id) on delete set null,
  storage_bucket text not null default 'post-media',
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null,
  media_type public.media_type not null,
  status public.media_asset_status not null default 'uploading',
  delete_after timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (storage_bucket, storage_path),
  constraint media_assets_file_size_positive check (file_size > 0),
  constraint media_assets_deleted_state check (
    (status = 'deleted' and deleted_at is not null)
    or (status <> 'deleted')
  )
);

comment on table public.media_assets is
  'Metadata for files stored in Supabase Storage. Binary files are not stored in Postgres. Cleanup workers must delete actual files with the Supabase Storage API, not SQL.';
comment on column public.media_assets.storage_bucket is
  'Assumed Storage bucket: post-media. Bucket creation and Storage policies are managed separately.';
comment on column public.media_assets.delete_after is
  'Cleanup target time. Immediate/scheduled upload success should set this to now(); failed uploads keep 24-72h; draft assets keep 7d.';
comment on column public.media_assets.status is
  'Clients may create/attach assets before SNS upload. The deleted status and deleted_at should be set only by server cleanup workers after Storage API deletion succeeds.';

create index media_assets_delete_after_idx
  on public.media_assets (delete_after)
  where deleted_at is null;
create index media_assets_status_idx on public.media_assets (status);
create index media_assets_user_id_idx on public.media_assets (user_id);
create index media_assets_post_id_idx on public.media_assets (post_id);
create index media_assets_user_status_delete_after_idx
  on public.media_assets (user_id, status, delete_after);

create trigger set_media_assets_updated_at
before update on public.media_assets
for each row execute function public.set_updated_at();

create table public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform public.platform not null,
  status public.account_status not null default 'needs_connection',
  handle text,
  description text,
  token_expires_at timestamptz,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, platform)
);

comment on table public.social_accounts is
  'Client-visible SNS connection metadata only. Access and refresh tokens are stored in private.social_account_secrets. OAuth server routes or Edge Functions should own insert/update/delete flows.';

create index social_accounts_user_id_idx on public.social_accounts (user_id);
create index social_accounts_user_platform_idx on public.social_accounts (user_id, platform);
create index social_accounts_status_idx on public.social_accounts (status);

create trigger set_social_accounts_updated_at
before update on public.social_accounts
for each row execute function public.set_updated_at();

create table private.social_account_secrets (
  social_account_id uuid primary key references public.social_accounts(id) on delete cascade,
  access_token text not null,
  refresh_token text,
  scopes text[] not null default '{}',
  provider_account_id text,
  raw_provider_payload jsonb,
  updated_at timestamptz not null default now()
);

comment on table private.social_account_secrets is
  'Private SNS token storage. Never expose this table to browser clients. Server routes or Edge Functions should access it with service_role only.';

revoke all on table private.social_account_secrets from public;
revoke all on table private.social_account_secrets from anon;
revoke all on table private.social_account_secrets from authenticated;
grant all on table private.social_account_secrets to service_role;

create trigger set_social_account_secrets_updated_at
before update on private.social_account_secrets
for each row execute function public.set_updated_at();

create table public.upload_logs (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform public.platform not null,
  status public.upload_status not null default 'pending',
  error_message text,
  attempted_at timestamptz not null default now(),
  completed_at timestamptz
);

comment on table public.upload_logs is
  'Platform-level upload attempts. Client reads logs only; server routes or Edge Functions should insert/update upload logs.';

create index upload_logs_user_id_idx on public.upload_logs (user_id);
create index upload_logs_post_id_idx on public.upload_logs (post_id);
create index upload_logs_status_idx on public.upload_logs (status);
create index upload_logs_platform_idx on public.upload_logs (platform);
create index upload_logs_user_status_attempted_at_idx on public.upload_logs (user_id, status, attempted_at desc);
create index upload_logs_post_platform_idx on public.upload_logs (post_id, platform);

create table public.usage_credits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.subscription_plans(id),
  week_start date not null,
  used_count integer not null default 0,
  bonus_count integer not null default 0,
  plan_limit integer not null,
  unique (user_id, week_start),
  constraint usage_credits_used_count_nonnegative check (used_count >= 0),
  constraint usage_credits_bonus_count_nonnegative check (bonus_count >= 0)
);

comment on table public.usage_credits is
  'Weekly upload usage. Client reads only; server routes or Edge Functions should update usage after successful upload jobs.';

create index usage_credits_user_id_idx on public.usage_credits (user_id);
create index usage_credits_week_start_idx on public.usage_credits (week_start);
create index usage_credits_user_week_start_idx on public.usage_credits (user_id, week_start);

create table public.referral_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  code text not null unique,
  uses_count integer not null default 0,
  created_at timestamptz not null default now(),
  constraint referral_codes_uses_count_nonnegative check (uses_count >= 0)
);

create index referral_codes_user_id_idx on public.referral_codes (user_id);
create index referral_codes_code_idx on public.referral_codes (code);

create table public.referral_rewards (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid not null references auth.users(id) on delete cascade,
  referral_code_id uuid not null references public.referral_codes(id) on delete cascade,
  reward_credits integer not null default 3,
  created_at timestamptz not null default now(),
  constraint no_self_referral check (referrer_user_id <> referred_user_id),
  constraint referral_rewards_reward_positive check (reward_credits > 0)
);

create index referral_rewards_referrer_user_id_idx on public.referral_rewards (referrer_user_id);
create index referral_rewards_referred_user_id_idx on public.referral_rewards (referred_user_id);
create index referral_rewards_referral_code_id_idx on public.referral_rewards (referral_code_id);

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = auth.uid()
      and is_admin = true
  );
$$;

create or replace function public.generate_referral_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate text;
  attempts integer := 0;
begin
  loop
    candidate := 'POSTBRIDGE-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (
      select 1
      from public.referral_codes
      where code = candidate
    );

    attempts := attempts + 1;
    if attempts >= 10 then
      raise exception 'PostBridge signup failed: could not generate a unique referral code';
    end if;
  end loop;

  return candidate;
end;
$$;

revoke all on function public.generate_referral_code() from public;
revoke all on function public.generate_referral_code() from anon;
revoke all on function public.generate_referral_code() from authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_plan_id uuid;
  default_plan_limit integer;
  display_name text;
begin
  select id, weekly_upload_limit
    into default_plan_id, default_plan_limit
  from public.subscription_plans
  where is_default = true
  order by sort_order
  limit 1;

  if default_plan_id is null then
    raise exception 'PostBridge signup failed: no default subscription plan exists';
  end if;

  display_name := coalesce(
    nullif(new.raw_user_meta_data->>'display_name', ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'PostBridge 사용자'
  );

  insert into public.profiles (user_id, display_name, plan_id)
  values (
    new.id,
    display_name,
    default_plan_id
  );

  insert into public.referral_codes (user_id, code)
  values (
    new.id,
    public.generate_referral_code()
  );

  insert into public.usage_credits (
    user_id,
    plan_id,
    week_start,
    used_count,
    bonus_count,
    plan_limit
  ) values (
    new.id,
    default_plan_id,
    date_trunc('week', now())::date,
    0,
    0,
    default_plan_limit
  );

  return new;
end;
$$;

create or replace function public.update_my_profile(
  display_name text default null,
  avatar_url text default null,
  locale text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'PostBridge profile update failed: authentication required';
  end if;

  update public.profiles
  set
    display_name = coalesce(nullif(update_my_profile.display_name, ''), profiles.display_name),
    avatar_url = update_my_profile.avatar_url,
    locale = coalesce(nullif(update_my_profile.locale, ''), profiles.locale)
  where user_id = auth.uid()
  returning * into updated_profile;

  if updated_profile.id is null then
    raise exception 'PostBridge profile update failed: profile not found';
  end if;

  return updated_profile;
end;
$$;

grant execute on function public.update_my_profile(text, text, text) to authenticated;
revoke all on function public.update_my_profile(text, text, text) from public;
revoke all on function public.update_my_profile(text, text, text) from anon;
grant execute on function public.update_my_profile(text, text, text) to authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.subscription_plans enable row level security;
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.media_assets enable row level security;
alter table public.social_accounts enable row level security;
alter table private.social_account_secrets enable row level security;
alter table public.upload_logs enable row level security;
alter table public.usage_credits enable row level security;
alter table public.referral_codes enable row level security;
alter table public.referral_rewards enable row level security;

create policy "subscription plans are readable by authenticated users"
on public.subscription_plans
for select
to authenticated
using (true);

create policy "profiles are readable by owner"
on public.profiles
for select
to authenticated
using (auth.uid() = user_id);

-- Profiles are not directly updatable by clients. Use
-- public.update_my_profile(display_name, avatar_url, locale), which limits
-- client-writable fields and prevents changes to is_admin, plan_id, and
-- referred_by_user_id.

create policy "posts are readable by owner"
on public.posts
for select
to authenticated
using (auth.uid() = user_id);

create policy "posts are insertable by owner"
on public.posts
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "posts are updatable by owner"
on public.posts
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "posts are deletable by owner"
on public.posts
for delete
to authenticated
using (auth.uid() = user_id);

create policy "media assets are readable by owner"
on public.media_assets
for select
to authenticated
using (auth.uid() = user_id);

create policy "media assets are insertable by owner"
on public.media_assets
for insert
to authenticated
with check (
  auth.uid() = user_id
  and status <> 'deleted'
  and deleted_at is null
);

create policy "media assets are updatable by owner"
on public.media_assets
for update
to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and status <> 'deleted'
  and deleted_at is null
);

-- media_assets delete is intentionally not granted to clients. Actual Storage
-- object removal and DB row deletion/state finalization should be performed by
-- server cleanup workers using the Supabase Storage API and service_role.

create policy "social accounts are readable by owner"
on public.social_accounts
for select
to authenticated
using (auth.uid() = user_id);

-- OAuth connection writes are allowed for MVP metadata flows, but final
-- production insert/update/delete should move behind Next Route Handlers or
-- Supabase Edge Functions so provider callbacks, token refreshes, and account
-- disconnects happen server-side.
create policy "social accounts are insertable by owner"
on public.social_accounts
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "social accounts are updatable by owner"
on public.social_accounts
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "social accounts are deletable by owner"
on public.social_accounts
for delete
to authenticated
using (auth.uid() = user_id);

-- No policy is created for private.social_account_secrets. With RLS enabled
-- and schema/table privileges revoked from anon/authenticated, browser clients
-- cannot read or write SNS tokens. Server routes or Edge Functions should use
-- service_role for token reads/writes and provider refresh flows.

create policy "upload logs are readable by owner"
on public.upload_logs
for select
to authenticated
using (auth.uid() = user_id);

-- upload_logs inserts/updates are intentionally not granted to clients.
-- Server routes or Edge Functions should create and update upload attempts.

create policy "usage credits are readable by owner"
on public.usage_credits
for select
to authenticated
using (auth.uid() = user_id);

-- usage_credits inserts/updates are intentionally not granted to clients.
-- Server routes or Edge Functions should increment usage after successful jobs.

create policy "referral codes are readable by owner"
on public.referral_codes
for select
to authenticated
using (auth.uid() = user_id);

create policy "referral rewards are readable by participants"
on public.referral_rewards
for select
to authenticated
using (auth.uid() = referrer_user_id or auth.uid() = referred_user_id);

-- Minimal admin foundation:
-- public.is_admin() exists for future admin read policies. This initial schema
-- keeps user data owner-scoped and avoids broad admin access until admin UI
-- routes are moved behind server-side authorization.
