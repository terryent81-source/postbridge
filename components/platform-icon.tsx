import { cn } from "@/lib/utils"
import type { Platform } from "@/lib/db"
import { Facebook, Instagram, Youtube } from "lucide-react"

const TikTokIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.69a8.16 8.16 0 0 0 4.77 1.52V6.84a4.85 4.85 0 0 1-1.84-.15z" />
  </svg>
)

const XIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
)

const ICONS: Record<Platform, (props: { className?: string }) => React.ReactNode> = {
  instagram: ({ className }) => <Instagram className={className} />,
  facebook: ({ className }) => <Facebook className={className} />,
  youtube: ({ className }) => <Youtube className={className} />,
  tiktok: ({ className }) => <TikTokIcon className={className} />,
  x: ({ className }) => <XIcon className={className} />,
}

const COLORS: Record<Platform, string> = {
  instagram: "bg-gradient-to-tr from-amber-500 via-pink-500 to-violet-500 text-white",
  facebook: "bg-[#1877F2] text-white",
  youtube: "bg-[#FF0000] text-white",
  tiktok: "bg-foreground text-background",
  x: "bg-foreground text-background",
}

const NAMES: Record<Platform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
  tiktok: "TikTok",
  x: "X",
}

export function PlatformIcon({
  platform,
  size = "md",
  className,
}: {
  platform: Platform
  size?: "sm" | "md" | "lg"
  className?: string
}) {
  const Icon = ICONS[platform]
  const sizeMap = {
    sm: { box: "h-6 w-6", icon: "h-3.5 w-3.5" },
    md: { box: "h-8 w-8", icon: "h-4 w-4" },
    lg: { box: "h-10 w-10", icon: "h-5 w-5" },
  }[size]

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-lg",
        COLORS[platform],
        sizeMap.box,
        className,
      )}
      aria-label={NAMES[platform]}
    >
      <Icon className={sizeMap.icon} />
    </span>
  )
}

export function PlatformBadge({ platform }: { platform: Platform }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium">
      <PlatformIcon platform={platform} size="sm" className="h-4 w-4 rounded-md" />
      {NAMES[platform]}
    </span>
  )
}

export const PLATFORM_NAMES = NAMES
