# Supabase Helpers

`client.ts` exports a browser-safe Supabase client initialized with:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

`server.ts` exports a cookie-aware App Router Supabase client for Server Components, Route Handlers, and Server Actions.

`service-role.ts` exports a server-only Supabase client for privileged cleanup jobs. It reads `SUPABASE_SERVICE_ROLE_KEY` from server environment variables and must never be imported by browser components.

Current integration scope:

- Email/password login and signup use Supabase Auth.
- Dashboard route protection is handled in `proxy.ts`.
- Posts, Storage uploads, `media_assets`, `usage_credits`, and `upload_logs` are connected incrementally.
- SNS API calls still use the mock MVP publish flow.
- Supabase Storage is temporary upload staging only, not permanent media storage.
- Browser code may mark media for cleanup, but actual Storage removal must happen in a server route or cleanup worker with `service_role`.
- Keep service-role operations out of browser code.
- `/api/cleanup/media` is protected by `CLEANUP_SECRET` and deletes only `pending_delete` media whose `delete_after` has passed.
