# Supabase Helpers

`client.ts` exports a browser-safe Supabase client initialized with:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

`server.ts` exports a cookie-aware App Router Supabase client for Server Components, Route Handlers, and Server Actions.

Current Auth scope:

- Email/password login and signup use Supabase Auth.
- Dashboard route protection is handled in `proxy.ts`.
- Posts, Storage uploads, and SNS API calls still use the mock MVP layer.
- Keep service-role operations out of browser code.
