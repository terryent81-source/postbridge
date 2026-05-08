import { AlertTriangle, ImageIcon, Paperclip, Video } from "lucide-react"
import {
  MEDIA_EXPIRED_MESSAGE,
  type SupabaseMediaAssetPreview,
} from "@/lib/supabase/media-assets"
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

  const hasDeleted = hasDeletedMediaAssets(mediaAssets)
  const representativeImage = mediaAssets.find(
    (asset) =>
      !hasDeletedMediaAsset(asset) && asset.media_type === "image" && asset.signedUrl,
  )
  const firstAsset = representativeImage ?? mediaAssets[0]
  const videoAsset = mediaAssets.find(
    (asset) => !hasDeletedMediaAsset(asset) && asset.media_type === "video",
  )
  const hasPendingDelete = mediaAssets.some((asset) => asset.status === "pending_delete")

  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      {hasDeleted ? (
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-destructive/30 bg-destructive/10 text-destructive">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        </span>
      ) : representativeImage?.signedUrl ? (
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
          {hasPendingDelete && !hasDeleted && (
            <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
              삭제 예정
            </span>
          )}
          {hasDeleted && (
            <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
              만료됨
            </span>
          )}
        </div>
        {!compact && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {hasDeleted
              ? MEDIA_EXPIRED_MESSAGE
              : hasPendingDelete
                ? "업로드 완료 후 정리 예정"
                : videoAsset
                  ? `${videoAsset.file_name} · ${formatFileSize(videoAsset.file_size)} · ${videoAsset.mime_type}`
                  : firstAsset.file_name}
          </p>
        )}
      </div>
    </div>
  )
}

export function hasDeletedMediaAssets(mediaAssets?: SupabaseMediaAssetPreview[]) {
  return (mediaAssets ?? []).some(hasDeletedMediaAsset)
}

export function hasDeletedMediaAsset(asset: SupabaseMediaAssetPreview) {
  return asset.status === "deleted" || Boolean(asset.deleted_at)
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))}KB`
  }

  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}
