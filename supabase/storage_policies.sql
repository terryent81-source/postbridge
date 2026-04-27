-- PostBridge Supabase Storage policy draft.
-- Bucket: post-media
--
-- This file is intentionally separate from 001_initial_schema.sql because
-- Storage bucket creation/policies may be applied independently per
-- Supabase project/environment.
--
-- Expected object path:
--   post-media/{user_id}/{post_id}/{filename}
--
-- Actual cleanup/deletion of Storage objects must be performed by a server
-- route or cleanup worker using service_role and the Supabase Storage API.
-- Browser clients should not be allowed to delete files directly.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'post-media',
  'post-media',
  false,
  314572800,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/quicktime',
    'video/webm'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Users may upload only into their own top-level folder.
-- Path convention: {auth.uid()}/{post_id}/{filename}
create policy "post-media users can upload into own folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'post-media'
  and (storage.foldername(name))[1] = auth.uid()::text
  and array_length(storage.foldername(name), 1) >= 2
  and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
);

-- Users may read only their own files.
create policy "post-media users can read own files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'post-media'
  and (storage.foldername(name))[1] = auth.uid()::text
  and array_length(storage.foldername(name), 1) >= 2
);

-- Users may update metadata only for their own files. This is optional but
-- useful for resumable upload metadata. Content replacement should still be
-- controlled by app flow and media_assets records.
create policy "post-media users can update own files"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'post-media'
  and (storage.foldername(name))[1] = auth.uid()::text
  and array_length(storage.foldername(name), 1) >= 2
)
with check (
  bucket_id = 'post-media'
  and (storage.foldername(name))[1] = auth.uid()::text
  and array_length(storage.foldername(name), 1) >= 2
  and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
);

-- No delete policy for authenticated users.
-- Cleanup workers/server routes should call:
--   supabase.storage.from('post-media').remove([storage_path])
-- with service_role, then update public.media_assets:
--   status = 'deleted', deleted_at = now()
