# Supabase Storage Design

PostBridge stores uploaded image and video binaries in Supabase Storage, not in Postgres. Postgres stores metadata in `public.media_assets`.

## Bucket

- Bucket name: `post-media`
- Public: `false`
- Full path format: `post-media/{user_id}/{post_id}/{filename}`
- Storage object key format: `{user_id}/{post_id}/{filename}`
- Example object path stored in `media_assets.storage_path`: `{user_id}/{post_id}/hero-image.webp`

Bucket creation and Storage RLS policies are drafted in `supabase/storage_policies.sql`.

## Client Access Rules

- Authenticated users can upload only to their own top-level folder.
- Authenticated users can read only files under their own top-level folder.
- Authenticated users must not delete Storage files directly.
- File deletion is handled by a cleanup worker or server route using `service_role`.

## MIME Types

Allowed MVP MIME types:

- Images: `image/jpeg`, `image/png`, `image/webp`
- Videos: `video/mp4`, `video/quicktime`, `video/webm`

## File Size Limits

MVP limits:

- Image max: 10 MB
- Video max: 300 MB

Supabase bucket-level `file_size_limit` is set to 300 MB because it cannot express different limits per MIME group by itself. The application upload route or client validation should enforce the stricter 10 MB image limit before or during upload.

## media_assets Flow

1. Client uploads a file to bucket `post-media` with object key `{user_id}/{post_id}/{filename}`.
2. App creates a `public.media_assets` row with:
   - `storage_bucket = 'post-media'`
   - `storage_path = '{user_id}/{post_id}/{filename}'`
   - `file_name`
   - `mime_type`
   - `file_size`
   - `media_type`
   - `status`
   - `delete_after`
3. Posts link to files through `media_assets.post_id`, not `posts.media_urls`.
4. Upload workers use `media_assets` rows for SNS upload jobs.

## Deletion Policy

Storage deletion is not SQL. The cleanup worker must use Supabase Storage API:

```ts
await supabase.storage.from("post-media").remove([asset.storage_path])
```

After Storage removal succeeds, the worker updates Postgres:

```sql
update public.media_assets
set status = 'deleted',
    deleted_at = now()
where id = :asset_id;
```

Deletion timing:

- Immediate upload success: set `delete_after = now()`.
- Scheduled upload success: set `delete_after = now()`.
- Upload failed: keep for 24 to 72 hours, then delete.
- Draft assets: delete after 7 days.

## Cleanup Worker Query

The cleanup worker should periodically find candidates:

```sql
select id, storage_bucket, storage_path
from public.media_assets
where deleted_at is null
  and delete_after is not null
  and delete_after <= now()
  and status in ('upload_success', 'upload_failed', 'pending_delete', 'attached');
```

Recommended server-side steps:

1. Fetch cleanup candidates with `service_role`.
2. Call Supabase Storage API `remove`.
3. If remove succeeds, set `status = 'deleted'`, `deleted_at = now()`.
4. If remove fails, keep the row and retry later.

## Security Notes

- Storage policies protect user folder boundaries.
- `media_assets` RLS protects metadata boundaries.
- Browser clients cannot delete `media_assets` rows or Storage objects.
- Server routes and cleanup workers are responsible for final deletion and deleted-state updates.
