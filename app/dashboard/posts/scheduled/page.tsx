"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { PageHeader } from "@/components/app/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { PlatformIcon } from "@/components/platform-icon"
import { EmptyState } from "@/components/app/empty-state"
import { listScheduledPosts, mapPostToUi, MOCK_DB_CHANGED_EVENT, type UiPost } from "@/lib/db"
import {
  CalendarDays,
  CalendarX,
  ChevronLeft,
  ChevronRight,
  List,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"]

function buildMay2026() {
  const days: { date: number; current: boolean; iso?: string }[] = []
  const padPrev = [27, 28, 29, 30]
  padPrev.forEach((d) => days.push({ date: d, current: false }))
  for (let d = 1; d <= 31; d++) {
    const iso = `2026-05-${String(d).padStart(2, "0")}`
    days.push({ date: d, current: true, iso })
  }
  let next = 1
  while (days.length < 42) days.push({ date: next++, current: false })
  return days
}

export default function ScheduledPage() {
  const [view, setView] = useState<"calendar" | "list">("calendar")
  const [posts, setPosts] = useState<UiPost[]>([])
  const days = buildMay2026()

  useEffect(() => {
    let mounted = true
    const loadPosts = () => listScheduledPosts().then((rows) => {
      if (mounted) setPosts(rows.map(mapPostToUi))
    })
    loadPosts()
    window.addEventListener(MOCK_DB_CHANGED_EVENT, loadPosts)
    return () => {
      mounted = false
      window.removeEventListener(MOCK_DB_CHANGED_EVENT, loadPosts)
    }
  }, [])

  const postsByDay: Record<string, UiPost[]> = {}
  posts.forEach((p) => {
    if (!p.scheduledAt) return
    const date = p.scheduledAt.split(" ")[0]
    if (!postsByDay[date]) postsByDay[date] = []
    postsByDay[date].push(p)
  })

  const hasScheduled = posts.length > 0

  return (
    <>
      <PageHeader
        title="예약 게시물"
        description="예정된 업로드를 캘린더 또는 목록으로 확인하세요."
        action={
          <>
            <ToggleGroup
              type="single"
              value={view}
              onValueChange={(v) => v && setView(v as "calendar" | "list")}
              variant="outline"
              className="press-effect"
            >
              <ToggleGroupItem value="calendar" aria-label="달력 보기" className="gap-1.5">
                <CalendarDays className="h-4 w-4" /> 달력
              </ToggleGroupItem>
              <ToggleGroupItem value="list" aria-label="목록 보기" className="gap-1.5">
                <List className="h-4 w-4" /> 목록
              </ToggleGroupItem>
            </ToggleGroup>
            <Button
              asChild
              className="brand-gradient press-effect text-primary-foreground hover:opacity-95"
            >
              <Link href="/dashboard/posts/new">
                <Plus className="h-4 w-4" /> 새 예약
              </Link>
            </Button>
          </>
        }
      />

      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {!hasScheduled ? (
          <EmptyState
            icon={CalendarX}
            title="예약된 게시물이 없습니다"
            description="새 게시물을 작성하고 자동 발행 시간을 설정해 보세요."
            action={
              <Button
                asChild
                className="brand-gradient press-effect text-primary-foreground hover:opacity-95"
              >
                <Link href="/dashboard/posts/new">
                  <Plus className="h-4 w-4" /> 새 게시물 만들기
                </Link>
              </Button>
            }
          />
        ) : view === "calendar" ? (
          <Card className="border-border/80 shadow-sm">
            <CardContent className="p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-foreground">2026년 5월</h2>
                <div className="flex gap-1">
                  <Button variant="outline" size="icon" className="press-effect h-8 w-8">
                    <ChevronLeft className="h-4 w-4" />
                    <span className="sr-only">이전 달</span>
                  </Button>
                  <Button variant="outline" size="sm" className="press-effect">
                    오늘
                  </Button>
                  <Button variant="outline" size="icon" className="press-effect h-8 w-8">
                    <ChevronRight className="h-4 w-4" />
                    <span className="sr-only">다음 달</span>
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border text-center">
                {WEEKDAYS.map((w, i) => (
                  <div
                    key={w}
                    className={cn(
                      "bg-secondary/60 px-2 py-2 text-xs font-semibold",
                      i === 5 && "text-primary",
                      i === 6 && "text-destructive",
                      i < 5 && "text-muted-foreground",
                    )}
                  >
                    {w}
                  </div>
                ))}
                {days.map((d, i) => {
                  const list = d.iso ? postsByDay[d.iso] : undefined
                  return (
                    <div
                      key={i}
                      className={cn(
                        "min-h-[88px] bg-card p-1.5 text-left transition-colors hover:bg-secondary/40 sm:min-h-[112px]",
                        !d.current && "bg-muted/40 text-muted-foreground hover:bg-muted/40",
                      )}
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs font-semibold">{d.date}</span>
                        {list && list.length > 1 && (
                          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                            {list.length}
                          </span>
                        )}
                      </div>
                      <div className="space-y-1">
                        {list?.slice(0, 2).map((p) => (
                          <div
                            key={p.id}
                            className="flex cursor-pointer items-center gap-1 truncate rounded-md bg-primary/10 px-1.5 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/15"
                          >
                            <PlatformIcon
                              platform={p.platforms[0]}
                              size="sm"
                              className="h-3.5 w-3.5 rounded-sm"
                            />
                            <span className="truncate">{p.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {hasScheduled && (
          <div className="space-y-3">
            <h2 className="text-base font-bold text-foreground">예약 목록</h2>
            {posts.map((p) => (
              <Card
                key={p.id}
                className="card-hover border-border/80 shadow-sm hover:border-primary/30 hover:shadow-md"
              >
                <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-1 items-start gap-4">
                    <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-secondary/50 px-3 py-2 text-center">
                      <span className="text-[10px] font-semibold uppercase text-primary">
                        {p.scheduledAt?.split("-")[1]}월
                      </span>
                      <span className="text-xl font-extrabold text-foreground">
                        {p.scheduledAt?.split("-")[2]?.split(" ")[0]}일
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {p.scheduledAt?.split(" ")[1]}
                      </span>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">{p.title}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">생성일 {p.createdAt}</p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {p.platforms.map((pl) => (
                          <span
                            key={pl}
                            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2 py-0.5 text-xs"
                          >
                            <PlatformIcon
                              platform={pl}
                              size="sm"
                              className="h-4 w-4 rounded-sm"
                            />
                            <span className="capitalize">{pl === "x" ? "X" : pl}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="press-effect gap-1.5">
                      <Pencil className="h-3.5 w-3.5" /> 편집
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="press-effect gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => toast.success("예약이 취소되었습니다.")}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> 취소
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
