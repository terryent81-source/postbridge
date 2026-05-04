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

## GitHub Actions Scheduler

PostBridge is currently deployed to Vercel Hobby. Vercel Cron on the Hobby plan is limited to one cron execution per day, so it is not enough for 5-minute scheduled publishing. Use GitHub Actions as the external scheduler for the deployed app.

The repository includes two GitHub Actions workflows:

- `.github/workflows/postbridge-scheduled-publish.yml`
- `.github/workflows/postbridge-media-cleanup.yml`

Both workflows include `workflow_dispatch`, so they can be run manually from the GitHub Actions tab.

Scheduled publish:

- Runs every 5 minutes with `*/5 * * * *`.
- Calls `/api/scheduled/publish`.
- Sends `x-scheduled-publish-secret`.

Media cleanup:

- Runs every 30 minutes with `2,32 * * * *`.
- Calls `/api/cleanup/media`.
- Sends `x-cleanup-secret`.

GitHub Actions schedules use UTC. GitHub may also delay scheduled workflow runs by a few minutes when Actions has high load.

- Each API call uses `curl -f` so failed HTTP responses fail the workflow.
- Response bodies are printed in the Actions log so `scanned`, `published`, `failed`, and `deleted` results can be checked.

### Required GitHub Secrets

Register these three repository secrets in GitHub:

```txt
POSTBRIDGE_BASE_URL=https://postbridge-rose.vercel.app
SCHEDULED_PUBLISH_SECRET=Vercel에 넣은 SCHEDULED_PUBLISH_SECRET과 같은 값
CLEANUP_SECRET=Vercel에 넣은 CLEANUP_SECRET과 같은 값
```

GitHub path:

```txt
Repository -> Settings -> Secrets and variables -> Actions -> New repository secret
```

### Manual Run

1. Open the repository on GitHub.
2. Go to **Actions**.
3. Select **PostBridge Scheduled Publish** or **PostBridge Media Cleanup**.
4. Click **Run workflow**.

Manual runs call only the selected workflow's worker route.

### Worker Calls

Scheduled publish:

```txt
POST ${POSTBRIDGE_BASE_URL}/api/scheduled/publish
x-scheduled-publish-secret: ${SCHEDULED_PUBLISH_SECRET}
```

Media cleanup:

```txt
POST ${POSTBRIDGE_BASE_URL}/api/cleanup/media
x-cleanup-secret: ${CLEANUP_SECRET}
```

Keep these same secret values configured in Vercel environment variables. Vercel still hosts the API routes; GitHub Actions only triggers them on the required schedule.
