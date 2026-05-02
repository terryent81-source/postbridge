# Scheduler Operations

PostBridge currently uses mock SNS publishing. Scheduled publishing, upload logs, usage credits, and media cleanup are handled by server routes that are intended to be called by a scheduler.

Do not put `SUPABASE_SERVICE_ROLE_KEY` in browser code. The worker routes use the server-only service-role Supabase client.

## Routes

Scheduled publish worker:

```txt
POST /api/scheduled/publish
x-scheduled-publish-secret: ${SCHEDULED_PUBLISH_SECRET}
```

- Runs mock publish for up to 10 posts where `posts.status = 'scheduled'` and `scheduled_at <= now()`.
- Writes one `upload_logs` row per platform.
- Consumes one upload credit only when the scheduled mock publish succeeds.
- Marks successful post media as `pending_delete` with `delete_after = now()`.
- Marks failed post media as `pending_delete` with `delete_after = now() + 72 hours`.

Media cleanup worker:

```txt
POST /api/cleanup/media
x-cleanup-secret: ${CLEANUP_SECRET}
```

- Deletes Storage objects for `media_assets.status = 'pending_delete'` where `delete_after <= now()`.
- Marks successfully removed rows as `media_assets.status = 'deleted'`.

## Local Scripts

The Windows scripts do not read `.env.local`. Pass secrets explicitly or set process/user environment variables before running them.

Run scheduled publish locally:

```powershell
$env:POSTBRIDGE_BASE_URL = "http://localhost:3000"
$env:SCHEDULED_PUBLISH_SECRET = "REPLACE_WITH_SCHEDULED_PUBLISH_SECRET"
.\scripts\run-scheduled-publish.ps1
```

Run media cleanup locally:

```powershell
$env:POSTBRIDGE_BASE_URL = "http://localhost:3000"
$env:CLEANUP_SECRET = "REPLACE_WITH_CLEANUP_SECRET"
.\scripts\run-media-cleanup.ps1
```

You can also pass secrets as script parameters:

```powershell
.\scripts\run-scheduled-publish.ps1 `
  -BaseUrl "http://localhost:3000" `
  -Secret "REPLACE_WITH_SCHEDULED_PUBLISH_SECRET"

.\scripts\run-media-cleanup.ps1 `
  -BaseUrl "http://localhost:3000" `
  -Secret "REPLACE_WITH_CLEANUP_SECRET"
```

## Windows Task Scheduler

Before creating tasks, make sure the app is running at the configured base URL. For local testing this usually means `npm.cmd run dev` is running and reachable at `http://localhost:3000`.

Set user-level environment variables once:

```powershell
setx POSTBRIDGE_BASE_URL "http://localhost:3000"
setx SCHEDULED_PUBLISH_SECRET "REPLACE_WITH_SCHEDULED_PUBLISH_SECRET"
setx CLEANUP_SECRET "REPLACE_WITH_CLEANUP_SECRET"
```

Open a new PowerShell window after `setx`, because existing shells do not receive those values automatically.

### Scheduled Publish Every 5 Minutes

1. Open Windows Task Scheduler.
2. Select **Create Task**.
3. Name it `PostBridge Scheduled Publish`.
4. In **Triggers**, choose **New**.
5. Set **Begin the task** to `On a schedule`.
6. Set **Daily**, starting today.
7. Enable **Repeat task every** and choose `5 minutes`.
8. Set **for a duration of** to `Indefinitely`.
9. In **Actions**, choose **New**.
10. Program/script:

```txt
powershell.exe
```

11. Add arguments:

```txt
-NoProfile -ExecutionPolicy Bypass -File "C:\Users\yong\Desktop\postbridge\scripts\run-scheduled-publish.ps1"
```

12. Start in:

```txt
C:\Users\yong\Desktop\postbridge
```

### Media Cleanup Every 10 Or 30 Minutes

Create a second task named `PostBridge Media Cleanup`.

Use the same Task Scheduler setup as above, but set **Repeat task every** to either `10 minutes` for active testing or `30 minutes` for a quieter local setup.

Action arguments:

```txt
-NoProfile -ExecutionPolicy Bypass -File "C:\Users\yong\Desktop\postbridge\scripts\run-media-cleanup.ps1"
```

Start in:

```txt
C:\Users\yong\Desktop\postbridge
```

## Vercel Cron

After deployment, prefer Vercel Cron or an external scheduler over Windows Task Scheduler.

The cron jobs should call:

- `/api/scheduled/publish` every 5 minutes.
- `/api/cleanup/media` every 10 or 30 minutes.

Store these as Vercel environment variables:

- `SUPABASE_SERVICE_ROLE_KEY`
- `SCHEDULED_PUBLISH_SECRET`
- `CLEANUP_SECRET`

The scheduler must send the matching secret header with each request. Keep SNS publishing mocked until the real provider APIs are added.
