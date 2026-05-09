alter table public.media_assets
  add column if not exists original_size bigint,
  add column if not exists optimized_size bigint,
  add column if not exists optimization_status text not null default 'not_needed',
  add column if not exists original_media_url text,
  add column if not exists optimized_media_url text,
  add column if not exists optimized_storage_bucket text,
  add column if not exists optimized_storage_path text,
  add column if not exists optimized_mime_type text,
  add column if not exists optimization_error text,
  add column if not exists optimization_attempts integer not null default 0,
  add column if not exists optimization_settings jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'media_assets_optimization_status_check'
      and conrelid = 'public.media_assets'::regclass
  ) then
    alter table public.media_assets
      add constraint media_assets_optimization_status_check
      check (
        optimization_status in (
          'not_needed',
          'pending',
          'processing',
          'completed',
          'failed'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'media_assets_optimization_settings_object_check'
      and conrelid = 'public.media_assets'::regclass
  ) then
    alter table public.media_assets
      add constraint media_assets_optimization_settings_object_check
      check (jsonb_typeof(optimization_settings) = 'object');
  end if;
end $$;

create index if not exists media_assets_optimization_status_idx
  on public.media_assets (optimization_status);

comment on column public.media_assets.original_size is
  'Original uploaded file size in bytes before any video optimization.';
comment on column public.media_assets.optimized_size is
  'Optimized file size in bytes when FFmpeg optimization completes.';
comment on column public.media_assets.optimization_status is
  'Video optimization state: not_needed, pending, processing, completed, failed.';
comment on column public.media_assets.original_media_url is
  'Original storage path or URL. Tokens and signed URLs must not be stored here.';
comment on column public.media_assets.optimized_media_url is
  'Optimized storage path or URL. Tokens and signed URLs must not be stored here.';
