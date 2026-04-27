import { cn } from "@/lib/utils"

export function BrandLogo({
  className,
  showWordmark = true,
}: {
  className?: string
  showWordmark?: boolean
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        aria-hidden="true"
        className="brand-gradient relative inline-flex h-8 w-8 items-center justify-center rounded-lg shadow-sm shadow-primary/30"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-primary-foreground" fill="none">
          <path
            d="M5 12c2.5-3 5.5-3 8 0M11 12c2.5 3 5.5 3 8 0"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <circle cx="5" cy="12" r="2" fill="currentColor" />
          <circle cx="19" cy="12" r="2" fill="currentColor" />
        </svg>
      </span>
      {showWordmark && (
        <span className="text-base font-bold tracking-tight text-foreground">PostBridge</span>
      )}
    </span>
  )
}
