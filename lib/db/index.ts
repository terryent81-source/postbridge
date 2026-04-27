/**
 * Public entry point for the data layer.
 *
 * UI code should import from `@/lib/db` only — never from `./store` or
 * `./seed`. That way, when Supabase is wired up, only `./api.ts` changes.
 */

export * from "./types"
export * from "./api"
export * from "./mappers"
export { CURRENT_USER, DbError } from "./store"
