import "server-only"

export function getTikTokOAuthConfig(origin?: string) {
  const clientKey = process.env.TIKTOK_CLIENT_KEY
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET
  const redirectUri =
    process.env.TIKTOK_REDIRECT_URI ||
    `${origin || process.env.NEXT_PUBLIC_APP_URL || ""}/api/auth/tiktok/callback`
  const scopes = (process.env.TIKTOK_SCOPES || "user.info.basic,video.upload,video.publish")
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean)

  if (!clientKey) {
    throw new Error("TIKTOK_CLIENT_KEY_MISSING")
  }

  if (!clientSecret) {
    throw new Error("TIKTOK_CLIENT_SECRET_MISSING")
  }

  if (!redirectUri || redirectUri.startsWith("/")) {
    throw new Error("TIKTOK_REDIRECT_URI_MISSING")
  }

  return {
    clientKey,
    clientSecret,
    redirectUri,
    scopes,
  }
}
