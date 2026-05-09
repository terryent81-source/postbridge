alter table public.posts
  add column if not exists platform_settings jsonb not null default '{}'::jsonb;

alter table public.upload_logs
  add column if not exists platform_metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'posts_platform_settings_object_check'
      and conrelid = 'public.posts'::regclass
  ) then
    alter table public.posts
      add constraint posts_platform_settings_object_check
      check (jsonb_typeof(platform_settings) = 'object');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'upload_logs_platform_metadata_object_check'
      and conrelid = 'public.upload_logs'::regclass
  ) then
    alter table public.upload_logs
      add constraint upload_logs_platform_metadata_object_check
      check (jsonb_typeof(platform_metadata) = 'object');
  end if;
end $$;

comment on column public.posts.platform_settings is
  'Per-platform publishing options. YouTube privacyStatus is stored at youtube.privacyStatus.';

comment on column public.upload_logs.platform_metadata is
  'Safe per-attempt platform metadata such as selected YouTube privacyStatus. Never store tokens here.';
