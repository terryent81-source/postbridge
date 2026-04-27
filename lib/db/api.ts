/**
 * Mock service layer — the only module the UI should import from.
 *
 * Every function here is async and returns plain JSON-serializable shapes,
 * so swapping the implementation with Supabase queries (`supabase.from(...)`)
 * later won't require any UI changes.
 *
 * NOTE: This layer is intentionally NOT connected to Supabase yet.
 * When ready:
 *   1. Add `@supabase/supabase-js` and create a server/client helper.
 *   2. Replace each function body — keep the signatures the same.
 */

import { clone, CURRENT_USER, CURRENT_WEEK, db, DbError, delay, newId, nowISO } from "./store"
import type {
  AccountStatus,
  ConnectSocialAccountInput,
  CreatePostInput,
  Platform,
  Post,
  PostFilter,
  PostStatus,
  Profile,
  ReferralCode,
  ReferralReward,
  SocialAccount,
  SubscriptionPlan,
  UpdatePostInput,
  UploadLog,
  UploadStatus,
  UsageCredit,
  User,
} from "./types"

export const MOCK_DB_CHANGED_EVENT = "postbridge:mock-db-changed"

function notifyMockDbChanged(detail: string) {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(MOCK_DB_CHANGED_EVENT, { detail }))
}

// ====================================================================
//  AUTH / USER
// ====================================================================

/** Stand-in for `supabase.auth.getUser()`. */
export async function getCurrentUser(): Promise<User | null> {
  await delay(80)
  return db.users().find((u) => u.id === CURRENT_USER) ?? null
}

export async function getProfile(userId: string = CURRENT_USER): Promise<Profile | null> {
  await delay(80)
  return db.profiles().find((p) => p.user_id === userId) ?? null
}

export async function updateProfile(
  userId: string,
  patch: Partial<Pick<Profile, "display_name" | "avatar_url" | "locale">>,
): Promise<Profile> {
  await delay()
  const profile = db.profiles().find((p) => p.user_id === userId)
  if (!profile) throw new DbError("not_found", "프로필을 찾을 수 없습니다.")
  Object.assign(profile, patch, { updated_at: nowISO() })
  return profile
}

// ====================================================================
//  POSTS
// ====================================================================

export async function getPosts(
  userId: string = CURRENT_USER,
  filter: PostFilter = {},
): Promise<Post[]> {
  await delay()
  const { status, platform, search, limit, offset = 0 } = filter
  let rows = db.posts().filter((p) => p.user_id === userId)
  if (status) rows = rows.filter((p) => p.status === status)
  if (platform) rows = rows.filter((p) => p.platforms.includes(platform))
  if (search) {
    const q = search.toLowerCase()
    rows = rows.filter(
      (p) => p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q),
    )
  }
  rows = rows.sort((a, b) => b.created_at.localeCompare(a.created_at))
  if (typeof limit === "number") rows = rows.slice(offset, offset + limit)
  return rows.map(clone)
}

export async function listScheduledPosts(userId: string = CURRENT_USER): Promise<Post[]> {
  await delay()
  return db
    .posts()
    .filter((p) => p.user_id === userId && p.status === "scheduled")
    .sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""))
    .map(clone)
}

export async function getPost(postId: string): Promise<Post | null> {
  await delay(80)
  const row = db.posts().find((p) => p.id === postId)
  return row ? clone(row) : null
}

export async function createPost(
  userId: string,
  input: CreatePostInput,
): Promise<Post> {
  await delay()
  if (!input.title.trim()) throw new DbError("validation", "제목을 입력해 주세요.")
  if (!input.platforms.length) throw new DbError("validation", "최소 1개 이상의 플랫폼을 선택해 주세요.")
  const ts = nowISO()
  const post: Post = {
    id: newId("post"),
    user_id: userId,
    title: input.title.trim(),
    content: input.content,
    platforms: [...input.platforms],
    media_urls: input.media_urls ?? [],
    status: input.scheduled_at ? "scheduled" : "draft",
    scheduled_at: input.scheduled_at ?? null,
    published_at: null,
    fail_reason: null,
    created_at: ts,
    updated_at: ts,
  }
  db.posts().unshift(post)
  notifyMockDbChanged("posts")
  return clone(post)
}

export async function updatePost(postId: string, input: UpdatePostInput): Promise<Post> {
  await delay()
  const post = db.posts().find((p) => p.id === postId)
  if (!post) throw new DbError("not_found", "게시물을 찾을 수 없습니다.")
  Object.assign(post, input, { updated_at: nowISO() })
  notifyMockDbChanged("posts")
  return clone(post)
}

export async function schedulePost(postId: string, scheduledAt: string): Promise<Post> {
  await delay()
  const post = db.posts().find((p) => p.id === postId)
  if (!post) throw new DbError("not_found", "게시물을 찾을 수 없습니다.")
  if (new Date(scheduledAt).getTime() < Date.now()) {
    throw new DbError("validation", "예약 시간은 현재 이후여야 합니다.")
  }
  post.status = "scheduled"
  post.scheduled_at = scheduledAt
  post.fail_reason = null
  post.updated_at = nowISO()
  notifyMockDbChanged("posts")
  return clone(post)
}

/**
 * Marks a post as published and writes one upload_log row per platform.
 * Mocks success; real implementation would dispatch a queue job per
 * platform and update logs as each finishes.
 */
export async function publishPost(postId: string): Promise<Post> {
  await delay(450)
  const post = db.posts().find((p) => p.id === postId)
  if (!post) throw new DbError("not_found", "게시물을 찾을 수 없습니다.")

  // Verify all chosen platforms are connected
  const accounts = db.socialAccounts().filter((a) => a.user_id === post.user_id)
  const missing = post.platforms.filter(
    (pl) => !accounts.find((a) => a.platform === pl && a.status === "connected"),
  )
  if (missing.length) {
    const ts = nowISO()
    post.status = "failed"
    post.fail_reason = `연결 필요: ${missing.join(", ")}`
    post.updated_at = ts
    for (const platform of missing) {
      db.uploadLogs().unshift({
        id: newId("ul"),
        post_id: post.id,
        user_id: post.user_id,
        platform,
        status: "failed",
        error_message: "연결된 SNS 계정이 없거나 권한이 만료되었습니다.",
        attempted_at: ts,
        completed_at: null,
      })
    }
    notifyMockDbChanged("publish-failed")
    throw new DbError("conflict", post.fail_reason)
  }

  const ts = nowISO()
  post.status = "published"
  post.published_at = ts
  post.fail_reason = null
  post.updated_at = ts

  for (const platform of post.platforms) {
    db.uploadLogs().unshift({
      id: newId("ul"),
      post_id: post.id,
      user_id: post.user_id,
      platform,
      status: "success",
      error_message: null,
      attempted_at: ts,
      completed_at: ts,
    })
  }

  notifyMockDbChanged("publish")
  return clone(post)
}

export async function deletePost(postId: string): Promise<void> {
  await delay()
  const list = db.posts()
  const idx = list.findIndex((p) => p.id === postId)
  if (idx === -1) throw new DbError("not_found", "게시물을 찾을 수 없습니다.")
  list.splice(idx, 1)
  notifyMockDbChanged("posts")
}

// ====================================================================
//  SOCIAL ACCOUNTS
// ====================================================================

export async function getSocialAccounts(
  userId: string = CURRENT_USER,
): Promise<SocialAccount[]> {
  await delay()
  return db
    .socialAccounts()
    .filter((a) => a.user_id === userId)
    .map(clone)
}

export async function connectSocialAccount(
  userId: string,
  input: ConnectSocialAccountInput,
): Promise<SocialAccount> {
  await delay(380)
  const ts = nowISO()
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString()
  let account = db
    .socialAccounts()
    .find((a) => a.user_id === userId && a.platform === input.platform)

  if (account) {
    account.status = "connected"
    account.handle = input.handle ?? account.handle ?? `@${input.platform}_user`
    account.description = input.description ?? account.description
    account.access_token = "mock_access_token"
    account.refresh_token = "mock_refresh_token"
    account.token_expires_at = expires
    account.connected_at = ts
    account.updated_at = ts
  } else {
    account = {
      id: newId("sa"),
      user_id: userId,
      platform: input.platform,
      status: "connected",
      handle: input.handle ?? `@${input.platform}_user`,
      description: input.description ?? null,
      access_token: "mock_access_token",
      refresh_token: "mock_refresh_token",
      token_expires_at: expires,
      connected_at: ts,
      created_at: ts,
      updated_at: ts,
    }
    db.socialAccounts().push(account)
  }
  notifyMockDbChanged("social-accounts")
  return clone(account)
}

export async function connectAccount(
  platform: Platform,
  userId: string = CURRENT_USER,
): Promise<SocialAccount> {
  return connectSocialAccount(userId, { platform })
}

export async function disconnectSocialAccount(
  userId: string,
  platform: Platform,
): Promise<void> {
  await delay()
  const account = db
    .socialAccounts()
    .find((a) => a.user_id === userId && a.platform === platform)
  if (!account) throw new DbError("not_found", "연결된 계정을 찾을 수 없습니다.")
  account.status = "needs_connection"
  account.handle = null
  account.access_token = null
  account.refresh_token = null
  account.token_expires_at = null
  account.connected_at = null
  account.updated_at = nowISO()
  notifyMockDbChanged("social-accounts")
}

export async function disconnectAccount(
  platform: Platform,
  userId: string = CURRENT_USER,
): Promise<void> {
  return disconnectSocialAccount(userId, platform)
}

export async function setSocialAccountStatus(
  userId: string,
  platform: Platform,
  status: AccountStatus,
): Promise<SocialAccount> {
  await delay(120)
  const account = db
    .socialAccounts()
    .find((a) => a.user_id === userId && a.platform === platform)
  if (!account) throw new DbError("not_found", "연결된 계정을 찾을 수 없습니다.")
  account.status = status
  account.updated_at = nowISO()
  notifyMockDbChanged("social-accounts")
  return clone(account)
}

// ====================================================================
//  UPLOAD LOGS
// ====================================================================

export async function getUploadLogs(
  userId: string = CURRENT_USER,
  opts: { limit?: number; status?: UploadStatus } = {},
): Promise<UploadLog[]> {
  await delay()
  let rows = db.uploadLogs().filter((l) => l.user_id === userId)
  if (opts.status) rows = rows.filter((l) => l.status === opts.status)
  rows = rows.sort((a, b) => b.attempted_at.localeCompare(a.attempted_at))
  if (typeof opts.limit === "number") rows = rows.slice(0, opts.limit)
  return rows.map(clone)
}

// ====================================================================
//  PLANS
// ====================================================================

export async function getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  await delay(60)
  return db
    .plans()
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(clone)
}

// ====================================================================
//  USAGE CREDITS
// ====================================================================

/** Returns the current week's usage row, creating it if missing. */
export async function getUserUsageCredits(
  userId: string = CURRENT_USER,
): Promise<UsageCredit> {
  await delay(80)
  let row = db
    .usageCredits()
    .find((u) => u.user_id === userId && u.week_start === CURRENT_WEEK)
  if (!row) {
    const profile = db.profiles().find((p) => p.user_id === userId)
    const plan = db.plans().find((pl) => pl.id === profile?.plan_id) ?? db.plans()[0]
    row = {
      id: newId("uc"),
      user_id: userId,
      plan_id: plan.id,
      week_start: CURRENT_WEEK,
      used_count: 0,
      bonus_count: 0,
      plan_limit: plan.weekly_upload_limit,
    }
    db.usageCredits().push(row)
  }
  return clone(row)
}

/**
 * Adds bonus upload credits to the current week. Used by referral rewards
 * and admin grants.
 */
export async function addUploadCredit(
  userId: string,
  count: number,
): Promise<UsageCredit> {
  await delay()
  if (count <= 0) throw new DbError("validation", "추가할 업로드 횟수는 0보다 커야 합니다.")
  const row = await getUserUsageCredits(userId)
  const live = db.usageCredits().find((u) => u.id === row.id)!
  live.bonus_count += count
  notifyMockDbChanged("usage")
  return clone(live)
}

export async function recordWeeklyUpload(
  userId: string = CURRENT_USER,
  count = 1,
): Promise<UsageCredit> {
  await delay()
  if (count <= 0) throw new DbError("validation", "기록할 업로드 횟수는 0보다 커야 합니다.")
  const row = await getUserUsageCredits(userId)
  const live = db.usageCredits().find((u) => u.id === row.id)!
  live.used_count += count
  notifyMockDbChanged("usage")
  return clone(live)
}

// ====================================================================
//  REFERRALS
// ====================================================================

export async function getReferralCode(
  userId: string = CURRENT_USER,
): Promise<ReferralCode> {
  await delay(80)
  let code = db.referralCodes().find((c) => c.user_id === userId)
  if (!code) {
    code = {
      id: newId("rc"),
      user_id: userId,
      code: `POSTBRIDGE-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      uses_count: 0,
      created_at: nowISO(),
    }
    db.referralCodes().push(code)
  }
  return clone(code)
}

export async function getReferralRewards(
  userId: string = CURRENT_USER,
): Promise<ReferralReward[]> {
  await delay()
  return db
    .referralRewards()
    .filter((r) => r.referrer_user_id === userId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map(clone)
}

/**
 * Apply a referral code as a newly signed-up user. Grants reward credits
 * to both referrer and referred user.
 */
export async function applyReferralCode(
  newUserId: string,
  code: string,
): Promise<ReferralReward> {
  await delay(380)
  const trimmed = code.trim().toUpperCase()
  const referralCode = db.referralCodes().find((c) => c.code.toUpperCase() === trimmed)
  if (!referralCode) throw new DbError("not_found", "유효하지 않은 추천인 코드입니다.")
  if (referralCode.user_id === newUserId) {
    throw new DbError("validation", "본인의 코드는 사용할 수 없습니다.")
  }
  const profile = db.profiles().find((p) => p.user_id === newUserId)
  if (profile?.referred_by_user_id) {
    throw new DbError("conflict", "이미 추천인 코드를 사용했습니다.")
  }

  // Update profile
  if (profile) {
    profile.referred_by_user_id = referralCode.user_id
    profile.updated_at = nowISO()
  }
  referralCode.uses_count += 1

  // Create the reward record
  const reward: ReferralReward = {
    id: newId("rr"),
    referrer_user_id: referralCode.user_id,
    referred_user_id: newUserId,
    referral_code_id: referralCode.id,
    reward_credits: 3,
    created_at: nowISO(),
  }
  db.referralRewards().unshift(reward)

  // Grant credits to both sides
  await addUploadCredit(referralCode.user_id, reward.reward_credits)
  await addUploadCredit(newUserId, reward.reward_credits)

  notifyMockDbChanged("referrals")
  return clone(reward)
}

// ====================================================================
//  ADMIN HELPERS (read-only listings used by admin page)
// ====================================================================

export interface AdminUserRow {
  user: User
  profile: Profile | null
  plan: SubscriptionPlan | null
  posts_count: number
}

export interface AdminLogRow {
  id: string
  user: User | null
  profile: Profile | null
  post: Post | null
  log: UploadLog
}

export async function listAdminUsers(): Promise<AdminUserRow[]> {
  await delay()
  return db.users().map((user) => {
    const profile = db.profiles().find((p) => p.user_id === user.id) ?? null
    const plan = profile ? db.plans().find((pl) => pl.id === profile.plan_id) ?? null : null
    const posts_count = db.posts().filter((p) => p.user_id === user.id).length
    return { user, profile, plan, posts_count }
  })
}

export async function getAdminLogs(): Promise<AdminLogRow[]> {
  await delay()
  return db
    .uploadLogs()
    .slice()
    .sort((a, b) => b.attempted_at.localeCompare(a.attempted_at))
    .map((log) => {
      const user = db.users().find((u) => u.id === log.user_id) ?? null
      const profile = user ? db.profiles().find((p) => p.user_id === user.id) ?? null : null
      const post = db.posts().find((p) => p.id === log.post_id) ?? null
      return { id: log.id, user, profile, post, log: clone(log) }
    })
}
