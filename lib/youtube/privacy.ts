export type YouTubePrivacyStatus = "public" | "unlisted" | "private"

export const YOUTUBE_PRIVACY_OPTIONS: Array<{
  value: YouTubePrivacyStatus
  label: string
}> = [
  { value: "public", label: "공개" },
  { value: "unlisted", label: "일부 공개" },
  { value: "private", label: "비공개" },
]

export function parseYouTubePrivacyStatus(
  value: unknown,
  fallback: YouTubePrivacyStatus = "private",
): YouTubePrivacyStatus {
  return value === "public" || value === "unlisted" || value === "private"
    ? value
    : fallback
}

export function getYouTubePrivacyStatusFromPost(input: {
  platform_settings?: unknown
}) {
  if (!input.platform_settings || typeof input.platform_settings !== "object") {
    return "private" satisfies YouTubePrivacyStatus
  }

  const settings = input.platform_settings as {
    youtube?: { privacyStatus?: unknown }
  }

  return parseYouTubePrivacyStatus(settings.youtube?.privacyStatus, "private")
}
