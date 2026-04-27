import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PlatformIcon } from "@/components/platform-icon"
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Sparkles,
  Loader2,
} from "lucide-react"
import type { Platform } from "@/lib/db"

const PLATFORMS: Platform[] = ["instagram", "facebook", "youtube", "tiktok", "x"]

export function Hero() {
  return (
    <section className="brand-soft-bg relative overflow-hidden">
      <div
        className="pattern-dots absolute inset-0 -z-10 opacity-50"
        aria-hidden="true"
      />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 pt-12 pb-16 sm:px-6 md:grid-cols-[1.1fr_1fr] md:pt-20 md:pb-24 lg:gap-16">
        {/* Left */}
        <div className="flex flex-col justify-center">
          <Badge
            variant="secondary"
            className="mb-5 w-fit gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-primary"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="text-xs font-semibold">AI로 가속화되는 콘텐츠 워크플로우</span>
          </Badge>

          <h1 className="text-pretty text-4xl font-extrabold leading-[1.1] tracking-tight text-foreground sm:text-5xl md:text-[3.5rem]">
            한 번의 클릭으로 여러 SNS에{" "}
            <span className="brand-gradient-text">동시에 업로드</span>하세요
          </h1>

          <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            Instagram, Facebook, YouTube, TikTok, X — 5개 플랫폼 콘텐츠를 한곳에서 작성·예약·발행하세요.
            반복 업로드는 그만, 콘텐츠 본질에만 집중할 수 있습니다.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="brand-gradient press-effect h-12 px-6 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-95 hover:shadow-xl hover:shadow-primary/25"
            >
              <Link href="/signup">
                무료로 시작하기
                <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="press-effect h-12 border-border bg-card px-6 text-base hover:bg-secondary"
            >
              <Link href="/dashboard">데모 둘러보기</Link>
            </Button>
          </div>

          <ul className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />
              매주 무료 3회
            </li>
            <li className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />
              신용카드 불필요
            </li>
            <li className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />
              30초 만에 시작
            </li>
          </ul>

          <div className="mt-8">
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              지원 플랫폼
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {PLATFORMS.map((p) => (
                <div
                  key={p}
                  className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm"
                >
                  <PlatformIcon platform={p} size="sm" className="h-5 w-5 rounded-md" />
                  <span className="text-xs font-semibold text-foreground">
                    {p === "x" ? "X" : p[0].toUpperCase() + p.slice(1)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right — Dashboard Preview */}
        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 -z-10 brand-gradient opacity-10 blur-3xl" aria-hidden="true" />
          <DashboardPreview />
        </div>
      </div>
    </section>
  )
}

function DashboardPreview() {
  return (
    <div className="relative w-full max-w-md">
      {/* Floating success toast */}
      <div className="absolute -left-4 -top-3 z-10 hidden rotate-[-3deg] items-center gap-2 rounded-xl border border-emerald-500/20 bg-card px-3 py-2 shadow-lg shadow-emerald-500/10 sm:flex">
        <span className="relative flex h-2 w-2">
          <span className="absolute inset-0 rounded-full bg-emerald-500 animate-pulse-ring" />
          <span className="relative h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <span className="text-[11px] font-semibold text-foreground">3개 플랫폼에 업로드 완료</span>
      </div>

      {/* Floating metric chip */}
      <div className="absolute -right-3 bottom-10 z-10 hidden rotate-[2deg] flex-col rounded-xl border border-border bg-card px-3 py-2 shadow-lg sm:flex">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          이번 주 절약
        </span>
        <span className="text-lg font-extrabold text-foreground">4시간 12분</span>
      </div>

      <div className="relative rotate-[-1deg] rounded-2xl border border-border bg-card p-4 shadow-2xl shadow-primary/10 md:rotate-[1deg]">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
          </div>
          <span className="text-xs text-muted-foreground">PostBridge — 새 게시물</span>
        </div>

        <div className="rounded-xl border border-border bg-secondary/40 p-4">
          <div className="mb-3 flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground">콘텐츠 작성</span>
            <span className="text-muted-foreground">324 / 2200</span>
          </div>
          <div className="space-y-1.5">
            <div className="h-2 w-[88%] rounded-full bg-foreground/80" />
            <div className="h-2 w-[72%] rounded-full bg-foreground/60" />
            <div className="h-2 w-[60%] rounded-full bg-foreground/40" />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="aspect-square rounded-lg brand-gradient" />
            <div className="aspect-square rounded-lg bg-accent" />
            <div className="flex aspect-square items-center justify-center rounded-lg border border-border bg-secondary">
              <span className="text-lg text-muted-foreground">+</span>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between rounded-xl border border-border bg-background p-3">
          <span className="text-xs font-medium text-muted-foreground">선택된 플랫폼</span>
          <div className="flex -space-x-1.5">
            <PlatformIcon platform="instagram" size="sm" className="h-7 w-7 ring-2 ring-card" />
            <PlatformIcon platform="facebook" size="sm" className="h-7 w-7 ring-2 ring-card" />
            <PlatformIcon platform="youtube" size="sm" className="h-7 w-7 ring-2 ring-card" />
            <PlatformIcon platform="x" size="sm" className="h-7 w-7 ring-2 ring-card" />
          </div>
        </div>

        <div className="mt-3 space-y-2">
          <PreviewStatusRow platform="instagram" status="업로드 완료" tone="success" />
          <PreviewStatusRow platform="facebook" status="업로드 완료" tone="success" />
          <PreviewStatusRow platform="youtube" status="업로드 중" tone="progress" />
          <PreviewStatusRow platform="x" status="대기 중" tone="muted" />
        </div>
      </div>
    </div>
  )
}

function PreviewStatusRow({
  platform,
  status,
  tone,
}: {
  platform: Platform
  status: string
  tone: "success" | "progress" | "muted"
}) {
  const toneClass = {
    success: "text-emerald-600 bg-emerald-500/10",
    progress: "text-primary bg-primary/10",
    muted: "text-muted-foreground bg-muted",
  }[tone]

  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
      <div className="flex items-center gap-2">
        <PlatformIcon platform={platform} size="sm" />
        <span className="text-xs font-medium capitalize text-foreground">
          {platform === "x" ? "X" : platform}
        </span>
      </div>
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${toneClass}`}
      >
        {tone === "progress" && (
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        )}
        {tone === "success" && <CheckCircle2 className="h-3 w-3" aria-hidden="true" />}
        {tone === "muted" && <Clock className="h-3 w-3" aria-hidden="true" />}
        {status}
      </span>
    </div>
  )
}
