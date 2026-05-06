# Supabase Storage Design

PostBridge stores uploaded image and video binaries in Supabase Storage only as temporary SNS upload staging. Supabase Storage is not a permanent media archive for the product. Postgres stores metadata and cleanup state in `public.media_assets`.

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
- Browser code may mark owned media as `pending_delete`, but it must never use a service-role key or remove Storage objects directly.

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
5. Published post media is removed by the cleanup worker immediately.
6. Failed post media is kept for 24 hours, then removed by the cleanup worker.
7. Draft media is kept for 24 hours after the draft was last updated. Scheduled media is kept until the scheduled publish attempt runs.

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
- Upload failed: keep for 24 hours after the post enters `failed`, then delete.
- Draft assets: keep for 24 hours after the draft was last updated, then delete.
- Scheduled assets: keep until scheduled execution finishes.
- Orphan Storage objects: delete after 1 hour if they are not connected to `media_assets` and `posts`.

## Cleanup Worker Query

The cleanup worker should periodically find candidates by joining `media_assets` to `posts` and checking post status:

- `published`: delete immediately.
- `scheduled`: keep.
- `draft`: delete after 24 hours based on `posts.updated_at`.
- `failed`: delete after 24 hours based on `posts.updated_at`.
- orphan Storage objects: delete after 1 hour if no live `media_assets` and `posts` connection exists.

Recommended server-side steps:

1. Fetch cleanup candidates with `service_role`.
2. Call Supabase Storage API `remove`.
3. If remove succeeds, set `status = 'deleted'`, `deleted_at = now()`.
4. If remove fails, keep the row and retry later.

## Cleanup Route

The app includes a server-only cleanup route for Vercel Cron or an external scheduler:

```txt
POST /api/cleanup/media
x-cleanup-secret: ${CLEANUP_SECRET}
```

Required server environment variables:

- `SUPABASE_SERVICE_ROLE_KEY`
- `CLEANUP_SECRET`

The route uses the server-only service-role Supabase client. It removes objects from the private `post-media` bucket with the Supabase Storage API and marks successful `media_assets` rows as `status = 'deleted'`, `deleted_at = now()`. It does not delete `posts` rows or `upload_logs` rows. Failed Storage removals are reported in the JSON response and can be retried by the next scheduler run.

## Scheduled Publish Route

The app also includes a server-only route for scheduled mock publishing:

```txt
POST /api/scheduled/publish
x-scheduled-publish-secret: ${SCHEDULED_PUBLISH_SECRET}
```

Required server environment variables:

- `SUPABASE_SERVICE_ROLE_KEY`
- `SCHEDULED_PUBLISH_SECRET`

The route selects up to 10 posts where `status = 'scheduled'` and `scheduled_at <= now()`. It keeps the current mock SNS publish behavior, writes one `upload_logs` row per target platform, consumes one weekly upload credit only after a successful mock publish, marks successful posts as `published`, and marks failed posts as `failed` with `fail_reason`.

Media cleanup timing matches the Storage policy:

- Successful scheduled publish: cleanup deletes the published post media immediately.
- Failed scheduled publish: cleanup keeps media for 24 hours after the post becomes `failed`.

Local PowerShell example:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:3000/api/scheduled/publish" `
  -Headers @{ "x-scheduled-publish-secret" = $env:SCHEDULED_PUBLISH_SECRET }
```

## Security Notes

- Storage policies protect user folder boundaries.
- `media_assets` RLS protects metadata boundaries.
- Browser clients cannot delete `media_assets` rows or Storage objects.
- Server routes and cleanup workers are responsible for final deletion and deleted-state updates.
- `SUPABASE_SERVICE_ROLE_KEY` must exist only in server runtime configuration, never in browser-visible variables.
- `SCHEDULED_PUBLISH_SECRET` must be stored only as a server/runtime secret and sent only by the scheduler.
