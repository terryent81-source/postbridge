import "server-only"

import { getMetaGraphApiVersion } from "@/lib/server/upload/mode"

export function getMetaOAuthConfig(origin?: string) {
  const clientId = process.env.META_CLIENT_ID
  const clientSecret = process.env.META_CLIENT_SECRET
  const redirectUri =
    process.env.META_REDIRECT_URI ||
    `${origin || process.env.NEXT_PUBLIC_APP_URL || ""}/api/auth/meta/callback`

  if (!clientId) {
    throw new Error("Missing META_CLIENT_ID")
  }

  if (!clientSecret) {
    throw new Error("Missing META_CLIENT_SECRET")
  }

  if (!redirectUri || redirectUri.startsWith("/")) {
    throw new Error("Missing META_REDIRECT_URI")
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
    graphVersion: getMetaGraphApiVersion(),
  }
}

export const META_OAUTH_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "instagram_basic",
  "instagram_content_publish",
  "business_management",
]
