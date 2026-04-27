import { cn } from "@/lib/utils"
import { type PostStatus, STATUS_LABELS } from "@/lib/db"

const STATUS_STYLES: Record<PostStatus, string> = {
  draft: "bg-muted text-muted-foreground border border-border",
  scheduled: "bg-primary/10 text-primary border border-primary/20",
  published: "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 dark:text-emerald-400",
  failed: "bg-destructive/10 text-destructive border border-destructive/20",
}

export function StatusBadge({ status }: { status: PostStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        STATUS_STYLES[status],
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}
