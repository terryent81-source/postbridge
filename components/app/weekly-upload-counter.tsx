"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Sparkles, Zap } from "lucide-react"
import { getUserUsageCredits, MOCK_DB_CHANGED_EVENT } from "@/lib/db"
import {
  getMyUsageCredits,
  getUsageCreditTotal,
  SUPABASE_USAGE_CREDITS_CHANGED_EVENT,
} from "@/lib/supabase/usage-credits"
import { cn } from "@/lib/utils"

export type WeeklyUploadCounterProps = {
  used?: number
  total?: number
  resetLabel?: string
  variant?: "card" | "compact" | "sidebar"
  className?: string
}

/**
 * Weekly free upload counter. Shows used / total with a progress ring or bar.
 * Variants:
 *  - card: full card with CTA (used in dashboard)
 *  - compact: small chip-style row (used in topbar / page header)
 *  - sidebar: condensed for sidebar footer
 */
export function WeeklyUploadCounter({
  used,
  total,
  resetLabel = "월요일 자정 초기화",
  variant = "card",
  className,
}: WeeklyUploadCounterProps) {
  const [usage, setUsage] = useState<{ used: number; total: number } | null>(null)

  useEffect(() => {
    if (typeof used === "number" && typeof total === "number") return
    let mounted = true
    const loadUsage = async () => {
      const supabaseRow = await getMyUsageCredits().catch(() => null)

      if (!mounted) return

      if (supabaseRow) {
        setUsage({
          used: supabaseRow.used_count,
          total: getUsageCreditTotal(supabaseRow),
        })
        return
      }

      const row = await getUserUsageCredits()
      if (!mounted) return
      setUsage({
        used: row.used_count,
        total:
          row.plan_limit < 0
            ? row.used_count + row.bonus_count
            : row.plan_limit + row.bonus_count,
      })
    }
    loadUsage()
    window.addEventListener(MOCK_DB_CHANGED_EVENT, loadUsage)
    window.addEventListener(SUPABASE_USAGE_CREDITS_CHANGED_EVENT, loadUsage)
    return () => {
      mounted = false
      window.removeEventListener(MOCK_DB_CHANGED_EVENT, loadUsage)
      window.removeEventListener(SUPABASE_USAGE_CREDITS_CHANGED_EVENT, loadUsage)
    }
  }, [total, used])

  const resolvedUsed = used ?? usage?.used ?? 0
  const resolvedTotal = total ?? usage?.total ?? 3
  const remaining = Math.max(resolvedTotal - resolvedUsed, 0)
  const pct = resolvedTotal > 0 ? Math.min((resolvedUsed / resolvedTotal) * 100, 100) : 0
  const isLow = remaining === 0

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-border bg-card px-2.5 py-1",
          className,
        )}
      >
        <Zap className={cn("h-3.5 w-3.5", isLow ? "text-destructive" : "text-primary")} aria-hidden="true" />
        <span className="text-xs font-semibold text-foreground">
          {remaining}
          <span className="text-muted-foreground">/{resolvedTotal}</span>
        </span>
        <span className="hidden text-xs text-muted-foreground sm:inline">남음</span>
      </div>
    )
  }

  if (variant === "sidebar") {
    return (
      <div className={cn("rounded-xl border border-border bg-card p-3", className)}>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">이번 주 무료 업로드</span>
          <span className="text-xs font-bold text-primary">
            {remaining}/{resolvedTotal}
          </span>
        </div>
        <Progress value={pct} className="h-1.5" />
        <p className="mt-2 text-[11px] text-muted-foreground">{resetLabel}</p>
      </div>
    )
  }

  // card variant
  return (
    <Card
      className={cn(
        "relative overflow-hidden border-primary/30 shadow-md transition-shadow hover:shadow-lg",
        className,
      )}
    >
      <div className="brand-gradient absolute inset-0 -z-0 opacity-[0.07]" aria-hidden="true" />
      <CardContent className="relative flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl brand-gradient text-primary-foreground shadow-sm">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
            이번 주 한도
          </span>
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground">이번 주 남은 무료 업로드</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-foreground">{remaining}</span>
            <span className="text-sm font-medium text-muted-foreground">/ {resolvedTotal}회</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <Progress value={pct} className="h-2" />
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              {resolvedUsed}회 사용
              {isLow && (
                <span className="ml-1.5 font-semibold text-destructive">· 한도 도달</span>
              )}
            </span>
            <span>{resetLabel}</span>
          </div>
        </div>

        <Link
          href="/dashboard/pricing"
          className="inline-flex h-9 items-center justify-center rounded-md border border-primary/30 bg-card text-xs font-semibold text-primary transition-all hover:bg-primary/5 hover:shadow-sm active:scale-[0.98]"
        >
          유료 플랜으로 업그레이드 →
        </Link>
      </CardContent>
    </Card>
  )
}
