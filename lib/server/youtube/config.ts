import "server-only"

export function getYouTubeOAuthConfig(origin?: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri =
    process.env.YOUTUBE_REDIRECT_URI ||
    `${origin || process.env.NEXT_PUBLIC_APP_URL || ""}/api/auth/youtube/callback`
  const uploadScope =
    process.env.YOUTUBE_UPLOAD_SCOPE ||
    "https://www.googleapis.com/auth/youtube.upload"
  const readScope =
    process.env.YOUTUBE_READ_SCOPE ||
    "https://www.googleapis.com/auth/youtube.readonly"

  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID_MISSING")
  }

  if (!clientSecret) {
    throw new Error("GOOGLE_CLIENT_SECRET_MISSING")
  }

  if (!redirectUri || redirectUri.startsWith("/")) {
    throw new Error("YOUTUBE_REDIRECT_URI_MISSING")
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
    scopes: [readScope, uploadScope],
  }
}
