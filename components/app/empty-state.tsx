import type { LucideIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  variant = "card",
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
  variant?: "card" | "inline"
}) {
  const inner = (
    <div className="flex flex-col items-center justify-center gap-3 py-10 px-6 text-center">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-8 ring-primary/5">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <div className="space-y-1.5">
        <h3 className="text-base font-bold text-foreground">{title}</h3>
        {description && (
          <p className="mx-auto max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  )

  if (variant === "inline") {
    return <div className={cn("rounded-xl border border-dashed border-border/80 bg-secondary/20", className)}>{inner}</div>
  }

  return (
    <Card className={cn("border-dashed border-border/80 bg-secondary/20 shadow-none", className)}>
      <CardContent className="p-0">{inner}</CardContent>
    </Card>
  )
}
