create or replace function public.upsert_social_account_secret(
  p_social_account_id uuid,
  p_access_token text,
  p_refresh_token text default null,
  p_scopes text[] default '{}'::text[],
  p_provider_account_id text default null,
  p_raw_provider_payload jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  insert into private.social_account_secrets (
    social_account_id,
    access_token,
    refresh_token,
    scopes,
    provider_account_id,
    raw_provider_payload
  )
  values (
    p_social_account_id,
    p_access_token,
    p_refresh_token,
    coalesce(p_scopes, '{}'::text[]),
    p_provider_account_id,
    p_raw_provider_payload
  )
  on conflict (social_account_id)
  do update set
    access_token = excluded.access_token,
    refresh_token = excluded.refresh_token,
    scopes = excluded.scopes,
    provider_account_id = excluded.provider_account_id,
    raw_provider_payload = excluded.raw_provider_payload,
    updated_at = now();
end;
$$;

revoke all on function public.upsert_social_account_secret(
  uuid,
  text,
  text,
  text[],
  text,
  jsonb
) from public;
revoke all on function public.upsert_social_account_secret(
  uuid,
  text,
  text,
  text[],
  text,
  jsonb
) from anon;
revoke all on function public.upsert_social_account_secret(
  uuid,
  text,
  text,
  text[],
  text,
  jsonb
) from authenticated;
grant execute on function public.upsert_social_account_secret(
  uuid,
  text,
  text,
  text[],
  text,
  jsonb
) to service_role;

create or replace function public.get_social_account_secret(
  p_social_account_id uuid
)
returns table (
  access_token text,
  refresh_token text,
  scopes text[],
  provider_account_id text,
  raw_provider_payload jsonb
)
language sql
security definer
set search_path = public, private
stable
as $$
  select
    s.access_token,
    s.refresh_token,
    s.scopes,
    s.provider_account_id,
    s.raw_provider_payload
  from private.social_account_secrets s
  where s.social_account_id = p_social_account_id;
$$;

revoke all on function public.get_social_account_secret(uuid) from public;
revoke all on function public.get_social_account_secret(uuid) from anon;
revoke all on function public.get_social_account_secret(uuid) from authenticated;
grant execute on function public.get_social_account_secret(uuid) to service_role;

create or replace function public.delete_social_account_secret(
  p_social_account_id uuid
)
returns void
language sql
security definer
set search_path = public, private
as $$
  delete from private.social_account_secrets
  where social_account_id = p_social_account_id;
$$;

revoke all on function public.delete_social_account_secret(uuid) from public;
revoke all on function public.delete_social_account_secret(uuid) from anon;
revoke all on function public.delete_social_account_secret(uuid) from authenticated;
grant execute on function public.delete_social_account_secret(uuid) to service_role;
