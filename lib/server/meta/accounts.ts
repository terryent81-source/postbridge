import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Platform } from "@/lib/db"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role"
import { getMetaGraphApiVersion } from "@/lib/server/upload/mode"

export const ADDITIONAL_META_PERMISSION_MESSAGE =
  "추가 Meta 권한 설정이 필요합니다"

export type MetaPageAccount = {
  id: string
  name: string
  category?: string
  tasks?: string[]
  access_token?: string
  permission_warning?: string | null
  instagram_business_account?: {
    id: string
    username?: string
    name?: string
  }
}

export type MetaSocialAccountRow = {
  id: string
  user_id: string
  platform: Platform
  status: "connected" | "needs_connection" | "expired"
  handle: string | null
  description: string | null
  page_id: string | null
  page_name: string | null
  instagram_business_account_id: string | null
  token_expires_at: string | null
  connected_at: string | null
  created_at: string
  updated_at: string
}

export type MetaErrorDetails = {
  step: string
  status?: number
  type?: string
  code?: number
  error_subcode?: number
  fbtrace_id?: string
  message: string
}

export type SafeMetaPageAccount = Omit<MetaPageAccount, "access_token">

type GraphErrorPayload = {
  error?: {
    message?: string
    type?: string
    code?: number
    error_subcode?: number
    fbtrace_id?: string
  }
}

export class MetaGraphRequestError extends Error {
  constructor(readonly details: MetaErrorDetails) {
    super(details.message)
    this.name = "MetaGraphRequestError"
  }
}

export async function fetchMetaPages(userAccessToken: string) {
  const graphVersion = getMetaGraphApiVersion()
  const pages = await fetchMetaPageList(
    graphVersion,
    userAccessToken,
    "id,name,category,tasks",
  )

  return Promise.all(
    pages.map(async (page) => {
      const [pageAccessToken, instagramBusinessAccount] = await Promise.all([
        fetchMetaPageAccessToken(graphVersion, userAccessToken, page.id),
        fetchMetaInstagramBusinessAccount(graphVersion, userAccessToken, page.id),
      ])

      return addPermissionWarning({
        ...page,
        access_token: pageAccessToken ?? undefined,
        instagram_business_account: instagramBusinessAccount ?? undefined,
      })
    }),
  )
}

async function fetchMetaPageList(
  graphVersion: string,
  userAccessToken: string,
  fields: string,
) {
  const url = new URL(`https://graph.facebook.com/${graphVersion}/me/accounts`)
  url.searchParams.set("fields", fields)
  url.searchParams.set("access_token", userAccessToken)

  let response: Response

  try {
    response = await fetch(url)
  } catch (error) {
    throw new MetaGraphRequestError({
      step: "me_accounts_fetch",
      message: sanitizeSensitiveText(
        error instanceof Error ? error.message : "Graph API fetch failed",
      ),
    })
  }

  let payload: ({ data?: MetaPageAccount[] } & GraphErrorPayload) | null = null

  try {
    payload = (await response.json()) as { data?: MetaPageAccount[] } & GraphErrorPayload
  } catch (error) {
    throw new MetaGraphRequestError({
      step: "me_accounts_json_parse",
      status: response.status,
      message: sanitizeSensitiveText(
        error instanceof Error ? error.message : "Graph API response was not valid JSON",
      ),
    })
  }

  if (!response.ok) {
    throw new MetaGraphRequestError(toMetaErrorDetails("me_accounts_request", response.status, payload))
  }

  return Array.isArray(payload.data) ? payload.data : []
}

async function fetchMetaPageAccessToken(
  graphVersion: string,
  userAccessToken: string,
  pageId: string,
) {
  const page = await fetchMetaPageFields<{ access_token?: string }>(
    graphVersion,
    userAccessToken,
    pageId,
    "access_token",
  )

  return page?.access_token ?? null
}

async function fetchMetaInstagramBusinessAccount(
  graphVersion: string,
  userAccessToken: string,
  pageId: string,
) {
  const page = await fetchMetaPageFields<{
    instagram_business_account?: MetaPageAccount["instagram_business_account"]
  }>(
    graphVersion,
    userAccessToken,
    pageId,
    "instagram_business_account{id,username,name}",
  )

  return page?.instagram_business_account ?? null
}

async function fetchMetaPageFields<T extends object>(
  graphVersion: string,
  userAccessToken: string,
  pageId: string,
  fields: string,
) {
  const url = new URL(`https://graph.facebook.com/${graphVersion}/${pageId}`)
  url.searchParams.set("fields", fields)
  url.searchParams.set("access_token", userAccessToken)

  try {
    const response = await fetch(url)

    if (!response.ok) {
      return null
    }

    return (await response.json().catch(() => null)) as T | null
  } catch {
    return null
  }
}

function addPermissionWarning(page: MetaPageAccount): MetaPageAccount {
  if (page.access_token) {
    return { ...page, permission_warning: null }
  }

  return {
    ...page,
    permission_warning: ADDITIONAL_META_PERMISSION_MESSAGE,
  }
}

export function stripMetaPageToken(page: MetaPageAccount): SafeMetaPageAccount {
  const { access_token: _accessToken, ...safePage } = page
  return safePage
}

export function toMetaErrorDetails(
  step: string,
  status: number | undefined,
  payload: GraphErrorPayload | null,
): MetaErrorDetails {
  const error = payload?.error

  return {
    step,
    status,
    type: sanitizeOptional(error?.type),
    code: error?.code,
    error_subcode: error?.error_subcode,
    fbtrace_id: sanitizeOptional(error?.fbtrace_id),
    message: sanitizeSensitiveText(error?.message ?? "Graph API request failed"),
  }
}

export function sanitizeSensitiveText(value: string) {
  return value
    .replace(/access_token=([^&\s]+)/gi, "access_token=[REDACTED]")
    .replace(/fb_exchange_token=([^&\s]+)/gi, "fb_exchange_token=[REDACTED]")
    .replace(/client_secret=([^&\s]+)/gi, "client_secret=[REDACTED]")
    .replace(/refresh_token=([^&\s]+)/gi, "refresh_token=[REDACTED]")
    .replace(/authorization_code=([^&\s]+)/gi, "authorization_code=[REDACTED]")
    .replace(/code=([^&\s]+)/gi, "code=[REDACTED]")
    .replace(/\b(EAA[A-Za-z0-9_-]{20,})\b/g, "[REDACTED]")
    .replace(/\b([A-Za-z0-9_-]{80,})\b/g, "[REDACTED]")
}

function sanitizeOptional(value: string | undefined) {
  return value ? sanitizeSensitiveText(value) : undefined
}

export async function getMetaAccounts(userId: string) {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("social_accounts")
    .select(
      "id, user_id, platform, status, handle, description, page_id, page_name, instagram_business_account_id, token_expires_at, connected_at, created_at, updated_at",
    )
    .eq("user_id", userId)
    .in("platform", ["facebook", "instagram"])
    .order("platform", { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []) as MetaSocialAccountRow[]
}

export async function getStoredMetaUserToken(userId: string) {
  const supabase = createSupabaseServiceRoleClient()
  const account = await getMetaAccount(supabase, userId)

  if (!account) {
    return null
  }

  const { data, error } = await supabase
    .schema("private")
    .from("social_account_secrets")
    .select("access_token, raw_provider_payload")
    .eq("social_account_id", account.id)
    .maybeSingle()

  if (error) {
    throw error
  }

  const rawPayload = data?.raw_provider_payload
  const userToken =
    rawPayload &&
    typeof rawPayload === "object" &&
    "meta_user_access_token" in rawPayload &&
    typeof rawPayload.meta_user_access_token === "string"
      ? rawPayload.meta_user_access_token
      : null

  return userToken ?? (typeof data?.access_token === "string" ? data.access_token : null)
}

export async function getStoredMetaTokenExpiresAt(userId: string) {
  const supabase = createSupabaseServiceRoleClient()
  const account = await getMetaAccount(supabase, userId)

  return account?.token_expires_at ?? null
}

export async function upsertMetaConnection({
  userId,
  userAccessToken,
  expiresAt,
}: {
  userId: string
  userAccessToken: string
  expiresAt: string | null
}) {
  const supabase = createSupabaseServiceRoleClient()
  const facebookAccount = await upsertSocialAccount(supabase, {
    userId,
    platform: "facebook",
    status: "needs_connection",
    handle: null,
    description: "Meta 계정이 연결되었습니다. 업로드에 사용할 Facebook Page를 선택해 주세요.",
    tokenExpiresAt: expiresAt,
  })

  const instagramAccount = await upsertSocialAccount(supabase, {
    userId,
    platform: "instagram",
    status: "needs_connection",
    handle: null,
    description: "Facebook Page 선택 후 연결된 Instagram Business 계정을 저장합니다.",
    tokenExpiresAt: expiresAt,
  })

  await Promise.all([
    upsertSecret(supabase, facebookAccount.id, userAccessToken, null, "meta_user", {
      meta_user_access_token: userAccessToken,
    }),
    upsertSecret(supabase, instagramAccount.id, userAccessToken, null, "meta_user", {
      meta_user_access_token: userAccessToken,
    }),
  ])
}

export async function saveSelectedMetaPage({
  userId,
  page,
  tokenExpiresAt,
}: {
  userId: string
  page: MetaPageAccount
  tokenExpiresAt: string | null
}) {
  if (!page.access_token) {
    throw new Error(ADDITIONAL_META_PERMISSION_MESSAGE)
  }

  const supabase = createSupabaseServiceRoleClient()
  const userAccessToken = await getStoredMetaUserToken(userId)
  const rawProviderPayload = userAccessToken
    ? { meta_user_access_token: userAccessToken }
    : null
  const instagramBusinessAccountId = page.instagram_business_account?.id ?? null
  const instagramHandle =
    page.instagram_business_account?.username ??
    page.instagram_business_account?.name ??
    null

  const facebookAccount = await upsertSocialAccount(supabase, {
    userId,
    platform: "facebook",
    status: "connected",
    handle: page.name,
    description: "Facebook Page 업로드에 사용할 Page가 선택되었습니다.",
    pageId: page.id,
    pageName: page.name,
    instagramBusinessAccountId,
    tokenExpiresAt,
    connectedAt: new Date().toISOString(),
  })

  await upsertSecret(
    supabase,
    facebookAccount.id,
    page.access_token,
    null,
    page.id,
    rawProviderPayload,
  )

  const instagramAccount = await upsertSocialAccount(supabase, {
    userId,
    platform: "instagram",
    status: instagramBusinessAccountId ? "connected" : "needs_connection",
    handle: instagramHandle,
    description: instagramBusinessAccountId
      ? "Instagram Business 계정이 Facebook Page와 연결되었습니다."
      : "선택한 Facebook Page에 연결된 Instagram Business 계정이 없습니다.",
    pageId: page.id,
    pageName: page.name,
    instagramBusinessAccountId,
    tokenExpiresAt,
    connectedAt: instagramBusinessAccountId ? new Date().toISOString() : null,
  })

  await upsertSecret(
    supabase,
    instagramAccount.id,
    page.access_token,
    null,
    instagramBusinessAccountId ?? page.id,
    rawProviderPayload,
  )

  return { facebookAccount, instagramAccount }
}

export async function disconnectMetaPlatform(userId: string, platform: Platform) {
  if (platform !== "facebook" && platform !== "instagram") {
    throw new Error("Only Facebook and Instagram can be disconnected here")
  }

  const supabase = createSupabaseServiceRoleClient()
  const account = await getSocialAccount(supabase, userId, platform)

  if (!account) {
    return null
  }

  await supabase
    .schema("private")
    .from("social_account_secrets")
    .delete()
    .eq("social_account_id", account.id)

  const { data, error } = await supabase
    .from("social_accounts")
    .update({
      status: "needs_connection",
      handle: null,
      description: "연결이 해제되었습니다.",
      page_id: null,
      page_name: null,
      instagram_business_account_id: null,
      token_expires_at: null,
      connected_at: null,
    })
    .eq("id", account.id)
    .select("*")
    .single()

  if (error) {
    throw error
  }

  return data as MetaSocialAccountRow
}

async function getMetaAccount(supabase: SupabaseClient, userId: string) {
  return (
    (await getSocialAccount(supabase, userId, "facebook")) ??
    (await getSocialAccount(supabase, userId, "instagram"))
  )
}

async function getSocialAccount(
  supabase: SupabaseClient,
  userId: string,
  platform: Platform,
) {
  const { data, error } = await supabase
    .from("social_accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("platform", platform)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data as MetaSocialAccountRow | null) ?? null
}

async function upsertSocialAccount(
  supabase: SupabaseClient,
  input: {
    userId: string
    platform: "facebook" | "instagram"
    status: "connected" | "needs_connection" | "expired"
    handle: string | null
    description: string | null
    pageId?: string | null
    pageName?: string | null
    instagramBusinessAccountId?: string | null
    tokenExpiresAt?: string | null
    connectedAt?: string | null
  },
) {
  const { data, error } = await supabase
    .from("social_accounts")
    .upsert(
      {
        user_id: input.userId,
        platform: input.platform,
        status: input.status,
        handle: input.handle,
        description: input.description,
        page_id: input.pageId ?? null,
        page_name: input.pageName ?? null,
        instagram_business_account_id: input.instagramBusinessAccountId ?? null,
        token_expires_at: input.tokenExpiresAt ?? null,
        connected_at: input.connectedAt ?? null,
      },
      { onConflict: "user_id,platform" },
    )
    .select("*")
    .single()

  if (error) {
    throw error
  }

  return data as MetaSocialAccountRow
}

async function upsertSecret(
  supabase: SupabaseClient,
  socialAccountId: string,
  accessToken: string,
  refreshToken: string | null,
  providerAccountId: string | null,
  rawProviderPayload: Record<string, unknown> | null = null,
) {
  const { error } = await supabase
    .schema("private")
    .from("social_account_secrets")
    .upsert(
      {
        social_account_id: socialAccountId,
        access_token: accessToken,
        refresh_token: refreshToken,
        scopes: [],
        provider_account_id: providerAccountId,
        raw_provider_payload: rawProviderPayload,
      },
      { onConflict: "social_account_id" },
    )

  if (error) {
    throw error
  }
}

export function getTokenExpiresAt(expiresInSeconds?: number) {
  if (!expiresInSeconds) {
    return null
  }

  return new Date(Date.now() + expiresInSeconds * 1000).toISOString()
}
