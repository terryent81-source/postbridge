-- Admin authorization tables and helpers.
-- Admin access is granted only by rows in public.admin_users.

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references auth.users(id) on delete cascade,
  email text not null,
  role text not null check (role in ('super_admin', 'admin')),
  is_active boolean not null default true,
  created_by uuid null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists admin_users_user_id_idx
  on public.admin_users (user_id);
create index if not exists admin_users_email_idx
  on public.admin_users (lower(email));
create index if not exists admin_users_active_role_idx
  on public.admin_users (is_active, role);

create trigger set_admin_users_updated_at
before update on public.admin_users
for each row execute function public.set_updated_at();

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid null references auth.users(id),
  target_user_id uuid null references auth.users(id),
  action text not null,
  old_role text null,
  new_role text null,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_logs_actor_user_id_idx
  on public.admin_audit_logs (actor_user_id);
create index if not exists admin_audit_logs_target_user_id_idx
  on public.admin_audit_logs (target_user_id);
create index if not exists admin_audit_logs_created_at_idx
  on public.admin_audit_logs (created_at desc);

alter table public.admin_users enable row level security;
alter table public.admin_audit_logs enable row level security;

create or replace function public.is_admin_user()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
      and is_active = true
      and role in ('super_admin', 'admin')
  );
$$;

create or replace function public.is_super_admin_user()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
      and is_active = true
      and role = 'super_admin'
  );
$$;

-- Keep existing policies that call public.is_admin() working, but move the
-- source of truth from profiles.is_admin to admin_users.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_admin_user();
$$;

revoke all on function public.is_admin_user() from public;
revoke all on function public.is_admin_user() from anon;
grant execute on function public.is_admin_user() to authenticated;

revoke all on function public.is_super_admin_user() from public;
revoke all on function public.is_super_admin_user() from anon;
grant execute on function public.is_super_admin_user() to authenticated;

revoke all on function public.is_admin() from public;
revoke all on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "admin users are readable by admins"
  on public.admin_users;
create policy "admin users are readable by admins"
on public.admin_users
for select
to authenticated
using (public.is_admin_user());

drop policy if exists "admin audit logs are readable by super admins"
  on public.admin_audit_logs;
create policy "admin audit logs are readable by super admins"
on public.admin_audit_logs
for select
to authenticated
using (public.is_super_admin_user());

grant select on public.admin_users to authenticated;
grant select on public.admin_audit_logs to authenticated;
grant all on public.admin_users to service_role;
grant all on public.admin_audit_logs to service_role;
