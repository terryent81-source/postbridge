/**
 * In-memory mock store. Acts as a stand-in for Supabase queries until the
 * real client is wired up.
 *
 * Replacement plan when Supabase is connected:
 *   - Delete this file (or keep for tests).
 *   - Re-implement the functions in `./api.ts` using
 *     `supabase.from("<table>").select(...)` etc.
 *   - Service signatures in `./api.ts` stay identical, so callers in the
 *     UI don't need to change.
 */

import {
  CURRENT_USER_ID,
  CURRENT_WEEK_START,
  SEED_PLANS,
  SEED_POSTS,
  SEED_PROFILES,
  SEED_REFERRAL_CODES,
  SEED_REFERRAL_REWARDS,
  SEED_SOCIAL_ACCOUNTS,
  SEED_UPLOAD_LOGS,
  SEED_USAGE_CREDITS,
  SEED_USERS,
} from "./seed"
import type {
  Post,
  Profile,
  ReferralCode,
  ReferralReward,
  SocialAccount,
  SubscriptionPlan,
  UploadLog,
  UsageCredit,
  User,
} from "./types"

interface MockTables {
  users: User[]
  profiles: Profile[]
  posts: Post[]
  social_accounts: SocialAccount[]
  upload_logs: UploadLog[]
  referral_codes: ReferralCode[]
  referral_rewards: ReferralReward[]
  subscription_plans: SubscriptionPlan[]
  usage_credits: UsageCredit[]
}

/**
 * Module-level singleton. In Next.js dev, modules are cached so this state
 * persists across requests in the same process. It will reset on cold
 * start — fine for a mock layer.
 *
 * In the current mock MVP, client-side navigation keeps this in-memory state
 * alive, but a full browser refresh reloads the bundle and resets everything
 * back to the seed data. That reset is expected until Supabase is connected.
 */
const tables: MockTables = {
  users: structuredClone(SEED_USERS),
  profiles: structuredClone(SEED_PROFILES),
  posts: structuredClone(SEED_POSTS),
  social_accounts: structuredClone(SEED_SOCIAL_ACCOUNTS),
  upload_logs: structuredClone(SEED_UPLOAD_LOGS),
  referral_codes: structuredClone(SEED_REFERRAL_CODES),
  referral_rewards: structuredClone(SEED_REFERRAL_REWARDS),
  subscription_plans: structuredClone(SEED_PLANS),
  usage_credits: structuredClone(SEED_USAGE_CREDITS),
}

export const db = {
  users: () => tables.users,
  profiles: () => tables.profiles,
  posts: () => tables.posts,
  socialAccounts: () => tables.social_accounts,
  uploadLogs: () => tables.upload_logs,
  referralCodes: () => tables.referral_codes,
  referralRewards: () => tables.referral_rewards,
  plans: () => tables.subscription_plans,
  usageCredits: () => tables.usage_credits,
}

// ---- Utilities ---------------------------------------------------------

export const CURRENT_USER = CURRENT_USER_ID
export const CURRENT_WEEK = CURRENT_WEEK_START

/**
 * Type-safe deep clone helper. Wraps `structuredClone` so it can be used
 * directly as an `Array.prototype.map` callback without confusing TS about
 * the return type (the native `structuredClone` overloads include a second
 * `options` argument that conflicts with the array `index` parameter).
 */
export const clone = <T>(value: T): T => structuredClone(value)

/** Simulated network/DB latency. */
export const delay = (ms = 220) => new Promise<void>((res) => setTimeout(res, ms))

/** Generate a stable-ish unique id with a readable prefix. */
export const newId = (prefix: string) => {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().split("-")[0]
      : Math.random().toString(36).slice(2, 10)
  return `${prefix}_${rand}`
}

export const nowISO = () => new Date().toISOString()

/** Structured error type so service callers can branch on it. */
export class DbError extends Error {
  code: "not_found" | "validation" | "conflict" | "forbidden"
  constructor(code: DbError["code"], message: string) {
    super(message)
    this.code = code
    this.name = "DbError"
  }
}

/** Reset state — useful for tests. Not part of the public api. */
export function _resetMockStore() {
  tables.users = structuredClone(SEED_USERS)
  tables.profiles = structuredClone(SEED_PROFILES)
  tables.posts = structuredClone(SEED_POSTS)
  tables.social_accounts = structuredClone(SEED_SOCIAL_ACCOUNTS)
  tables.upload_logs = structuredClone(SEED_UPLOAD_LOGS)
  tables.referral_codes = structuredClone(SEED_REFERRAL_CODES)
  tables.referral_rewards = structuredClone(SEED_REFERRAL_REWARDS)
  tables.subscription_plans = structuredClone(SEED_PLANS)
  tables.usage_credits = structuredClone(SEED_USAGE_CREDITS)
}
