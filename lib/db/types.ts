/**
 * Domain types for PostBridge.
 *
 * These match the shape of rows we plan to store in Supabase Postgres.
 * - snake_case column names (Postgres convention)
 * - timestamps are ISO-8601 strings (matches Supabase JSON serialization)
 * - foreign keys are <entity>_id and reference UUIDs
 *
 * When Supabase is connected, these types should map 1:1 to the generated
 * `Database["public"]["Tables"][...]["Row"]` types from supabase-gen.
 */

// ---- Primitives ---------------------------------------------------------

export type UUID = string
export type ISODateString = string

// ---- Enums --------------------------------------------------------------

export type Platform = "instagram" | "facebook" | "youtube" | "tiktok" | "x"

export type PostStatus = "draft" | "scheduled" | "published" | "failed"

export type AccountStatus =
  | "connected"
  | "needs_connection"
  | "expired"
  | "token_missing"

export type UploadStatus = "pending" | "success" | "failed"

export type UploadMode = "mock" | "real"
export type JsonObject = Record<string, unknown>

export type SubscriptionTier = "free" | "starter" | "pro" | "business"

export const PLATFORMS: { id: Platform; name: string; color: string; charLimit: number }[] = [
  { id: "instagram", name: "Instagram", color: "#E1306C", charLimit: 2200 },
  { id: "facebook", name: "Facebook", color: "#1877F2", charLimit: 63206 },
  { id: "youtube", name: "YouTube", color: "#FF0000", charLimit: 5000 },
  { id: "tiktok", name: "TikTok", color: "#000000", charLimit: 2200 },
  { id: "x", name: "X", color: "#000000", charLimit: 280 },
]

export const STATUS_LABELS: Record<PostStatus, string> = {
  draft: "임시저장",
  scheduled: "예약됨",
  published: "업로드 완료",
  failed: "실패",
}

export const ACCOUNT_STATUS_LABELS: Partial<Record<AccountStatus, string>> = {
  connected: "연결됨",
  needs_connection: "연결 필요",
  expired: "권한 만료",
}

// ---- Tables -------------------------------------------------------------

/**
 * Mirror of `auth.users` (Supabase). We never write to this directly when
 * running on Supabase — it's managed by Supabase Auth.
 */
export interface User {
  id: UUID
  email: string
  created_at: ISODateString
  last_sign_in_at: ISODateString | null
  is_admin: boolean
}

/**
 * `public.profiles` — 1:1 with `auth.users`. Stores display fields and the
 * user's current subscription plan.
 */
export interface Profile {
  id: UUID
  user_id: UUID
  display_name: string
  avatar_url: string | null
  locale: string
  plan_id: UUID
  referred_by_user_id: UUID | null
  created_at: ISODateString
  updated_at: ISODateString
}

/**
 * `public.posts` — a single post composed by the user, fanned out to
 * one or more platforms.
 */
export interface Post {
  id: UUID
  user_id: UUID
  title: string
  content: string
  platforms: Platform[]
  platform_settings?: JsonObject
  media_urls: string[]
  status: PostStatus
  scheduled_at: ISODateString | null
  published_at: ISODateString | null
  fail_reason: string | null
  created_at: ISODateString
  updated_at: ISODateString
}

/**
 * `public.social_accounts` — OAuth connections to external SNS providers.
 * Tokens are placeholders here; in real Supabase we'd store them encrypted
 * via Vault or a server-only column protected by RLS.
 */
export interface SocialAccount {
  id: UUID
  user_id: UUID
  platform: Platform
  status: AccountStatus
  handle: string | null
  description: string | null
  page_id: string | null
  page_name: string | null
  page_category?: string | null
  page_tasks?: string[] | null
  has_page_access_token?: boolean
  instagram_business_account_id: string | null
  youtube_shorts_auto_hashtag?: boolean
  youtube_shorts_hashtag_location?: "title" | "description"
  access_token: string | null
  refresh_token: string | null
  token_expires_at: ISODateString | null
  connected_at: ISODateString | null
  created_at: ISODateString
  updated_at: ISODateString
}

/**
 * `public.upload_logs` — one row per platform attempt for a given post.
 * Used to power the "업로드 내역" page and the admin log viewer.
 */
export interface UploadLog {
  id: UUID
  post_id: UUID
  user_id: UUID
  platform: Platform
  status: UploadStatus
  upload_mode?: UploadMode
  platform_metadata?: JsonObject
  platform_post_id?: string | null
  error_message: string | null
  attempted_at: ISODateString
  completed_at: ISODateString | null
}

/**
 * `public.referral_codes` — every user has exactly one referral code.
 */
export interface ReferralCode {
  id: UUID
  user_id: UUID
  code: string
  uses_count: number
  created_at: ISODateString
}

/**
 * `public.referral_rewards` — created when a new user signs up with an
 * existing user's code. Grants `reward_credits` weekly uploads to both
 * referrer and referred user.
 */
export interface ReferralReward {
  id: UUID
  referrer_user_id: UUID
  referred_user_id: UUID
  referral_code_id: UUID
  reward_credits: number
  created_at: ISODateString
}

/**
 * `public.subscription_plans` — the four PostBridge tiers. Read-only from
 * the client; managed by admins.
 */
export interface SubscriptionPlan {
  id: UUID
  tier: SubscriptionTier
  name: string
  price_monthly: number
  price_yearly: number
  /** -1 represents unlimited */
  weekly_upload_limit: number
  features: string[]
  is_default: boolean
  sort_order: number
}

/**
 * `public.usage_credits` — tracks weekly usage and bonus credits earned
 * from referrals. Resets every Monday (week_start anchors the row).
 */
export interface UsageCredit {
  id: UUID
  user_id: UUID
  plan_id: UUID
  /** Monday 00:00 (UTC) of the active week */
  week_start: ISODateString
  used_count: number
  bonus_count: number
  /** Snapshot of plan_limit at week start */
  plan_limit: number
}

// ---- Input shapes (for service functions) ------------------------------

export interface CreatePostInput {
  title: string
  content: string
  platforms: Platform[]
  platform_settings?: JsonObject
  media_urls?: string[]
  scheduled_at?: ISODateString | null
}

export interface UpdatePostInput {
  title?: string
  content?: string
  platforms?: Platform[]
  media_urls?: string[]
  status?: PostStatus
  scheduled_at?: ISODateString | null
  fail_reason?: string | null
}

export interface ConnectSocialAccountInput {
  platform: Platform
  handle?: string
  description?: string
}

export interface PostFilter {
  status?: PostStatus
  platform?: Platform
  search?: string
  limit?: number
  offset?: number
}
