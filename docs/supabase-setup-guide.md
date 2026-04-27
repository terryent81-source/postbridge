# Supabase Setup Guide

This guide prepares a real Supabase project for PostBridge. It does not connect the app code yet.

## 1. Create a Supabase Project

1. Go to the Supabase dashboard.
2. Create a new project.
3. Choose an organization, project name, database password, and region.
4. Wait until the project status is ready.
5. Open the project dashboard.

## 2. Apply SQL Files

Run these files in Supabase SQL Editor in this exact order:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/storage_policies.sql`

`001_initial_schema.sql` creates the database schema, enums, tables, indexes, triggers, helper functions, seed plans, and RLS policies.

`storage_policies.sql` creates/configures the `post-media` Storage bucket and Storage object policies.

## 3. Dashboard Checklist

After running the SQL, check these items in Supabase Dashboard.

Database checks:

- `subscription_plans` exists.
- `subscription_plans` has `free`, `starter`, `pro`, `business`.
- `free` has `is_default = true`.
- `profiles` exists.
- `posts` exists.
- `media_assets` exists.
- `social_accounts` exists.
- `upload_logs` exists.
- `usage_credits` exists.
- `referral_codes` exists.
- `referral_rewards` exists.
- `private.social_account_secrets` exists.
- `private.social_account_secrets` is not exposed to `anon` or `authenticated`.

Storage checks:

- `post-media` bucket exists.
- `post-media` bucket is private.
- Allowed MIME types include the approved image/video MIME types.
- Bucket file size limit is `300 MB`.

RLS checks:

- RLS is enabled on user data tables.
- `subscription_plans` is readable by authenticated users.
- `profiles`, `posts`, `media_assets`, `social_accounts` are owner-scoped by `auth.uid() = user_id`.
- `upload_logs` and `usage_credits` are client-select only.
- There is no client delete policy for `media_assets`.
- There is no client delete policy for `storage.objects` in `post-media`.

## 4. If SQL Fails

Check these common issues:

- Run order: `001_initial_schema.sql` must run before `storage_policies.sql`.
- Existing objects: if you already ran a partial migration, duplicate enum/table/policy names may fail.
- Storage schema availability: `storage.buckets` and `storage.objects` exist only inside a Supabase project.
- Private schema permissions: confirm `private` schema creation is allowed in the SQL Editor.
- Auth schema references: `auth.users` must exist; it exists in normal Supabase projects.
- Policy name conflicts: if re-running `storage_policies.sql`, existing policy names may need to be dropped first.
- Default plan: `handle_new_user()` requires one `subscription_plans.is_default = true` row.
- Bucket conflict: `storage_policies.sql` uses `on conflict (id)` for the bucket but policies themselves are not `create if not exists`.

For a clean re-run in a development project, prefer resetting the database or manually dropping conflicting policies/tables before applying again.

## 5. Find Supabase URL and anon Key

In Supabase Dashboard:

1. Open the project.
2. Go to Project Settings.
3. Open API.
4. Copy the Project URL.
5. Copy the public `anon` API key.

These will be used later by the Next.js app.

## 6. Future Environment Variables

When app integration starts, create `.env.local` with:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Do not commit `.env.local`.

## 7. Not Done Yet

This setup guide does not implement:

- Supabase client creation
- Real login/signup
- Supabase Auth session handling
- Storage upload UI integration
- SNS API OAuth
- SNS publishing jobs
- Cleanup worker

## Next Step

After the SQL is applied and dashboard checks pass, the next implementation step is to add Supabase client helpers and replace the mock auth/user lookup with Supabase Auth session reads.
