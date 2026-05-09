export function getYouTubeVideoUrl(videoId: string) {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`
}

export function getYouTubeStudioUrl(videoId: string) {
  return `https://studio.youtube.com/video/${encodeURIComponent(videoId)}/edit`
}

export function getRealYouTubeUrls(input: {
  platform: string
  status: string
  uploadMode?: string | null
  platformPostId?: string | null
}) {
  if (
    input.platform !== "youtube" ||
    input.status !== "success" ||
    input.uploadMode !== "real" ||
    !input.platformPostId
  ) {
    return null
  }

  return {
    youtubeUrl: getYouTubeVideoUrl(input.platformPostId),
    youtubeStudioUrl: getYouTubeStudioUrl(input.platformPostId),
  }
}
