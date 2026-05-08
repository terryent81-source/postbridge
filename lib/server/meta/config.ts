import "server-only"

import { getMetaGraphApiVersion } from "@/lib/server/upload/mode"

export function getMetaOAuthConfig(origin?: string) {
  const clientId = process.env.META_CLIENT_ID
  const clientSecret = process.env.META_CLIENT_SECRET
  const configId = process.env.META_CONFIG_ID
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
    configId,
    redirectUri,
    graphVersion: getMetaGraphApiVersion(),
  }
}
