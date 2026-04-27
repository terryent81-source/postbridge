import { cn } from "@/lib/utils"

export function PageHeader({
  title,
  description,
  action,
  className,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start justify-between gap-4 border-b border-border bg-background px-4 py-6 sm:flex-row sm:items-center sm:px-6 lg:px-8",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <h1 className="text-pretty text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 text-pretty text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action && (
        <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          {action}
        </div>
      )}
    </div>
  )
}
