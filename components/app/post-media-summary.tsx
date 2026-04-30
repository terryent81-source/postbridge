import { ImageIcon, Paperclip, Video } from "lucide-react"
import type { SupabaseMediaAssetPreview } from "@/lib/supabase/media-assets"
import { cn } from "@/lib/utils"

type PostMediaSummaryProps = {
  mediaAssets?: SupabaseMediaAssetPreview[]
  compact?: boolean
  className?: string
}

export function PostMediaSummary({
  mediaAssets = [],
  compact = false,
  className,
}: PostMediaSummaryProps) {
  if (mediaAssets.length === 0) {
    return <span className="text-xs text-muted-foreground">없음</span>
  }

  const representativeImage = mediaAssets.find(
    (asset) => asset.media_type === "image" && asset.signedUrl,
  )
  const firstAsset = representativeImage ?? mediaAssets[0]
  const videoAsset = mediaAssets.find((asset) => asset.media_type === "video")

  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      {representativeImage?.signedUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={representativeImage.signedUrl}
          alt={representativeImage.file_name}
          className="h-10 w-10 shrink-0 rounded-md border border-border object-cover"
        />
      ) : (
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-secondary text-muted-foreground">
          {firstAsset.media_type === "video" ? (
            <Video className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ImageIcon className="h-4 w-4" aria-hidden="true" />
          )}
        </span>
      )}
      <div className="min-w-0">
        <div className="flex items-center gap-1 text-xs font-semibold text-foreground">
          <Paperclip className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span>{mediaAssets.length}개 미디어</span>
        </div>
        {!compact && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {videoAsset
              ? `${videoAsset.file_name} · ${formatFileSize(videoAsset.file_size)} · ${videoAsset.mime_type}`
              : firstAsset.file_name}
          </p>
        )}
      </div>
    </div>
  )
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))}KB`
  }

  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}
