"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { PageHeader } from "@/components/app/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { StatusBadge } from "@/components/app/status-badge"
import { PlatformIcon } from "@/components/platform-icon"
import { WeeklyUploadCounter } from "@/components/app/weekly-upload-counter"
import {
  getProfile,
  getPosts,
  getSocialAccounts,
  getUploadLogs,
  getUserUsageCredits,
  listScheduledPosts,
  mapPostToUi,
  mapSocialAccountToUi,
  MOCK_DB_CHANGED_EVENT,
  type UiPost,
  type UiSocialAccount,
} from "@/lib/db"
import {
  Plus,
  CalendarClock,
  PlugZap,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  MoreHorizontal,
  ArrowUpRight,
  Eye,
} from "lucide-react"
import { cn } from "@/lib/utils"

export default function DashboardPage() {
  const [profileName, setProfileName] = useState("사용자")
  const [recentPosts, setRecentPosts] = useState<UiPost[]>([])
  const [socialAccounts, setSocialAccounts] = useState<UiSocialAccount[]>([])
  const [usage, setUsage] = useState({ used: 0, total: 3 })
  const [scheduledCount, setScheduledCount] = useState(0)
  const [failedCount, setFailedCount] = useState(0)

  useEffect(() => {
    let mounted = true
    const loadDashboard = () => Promise.all([
      getProfile(),
      getPosts(undefined, { limit: 6 }),
      getSocialAccounts(),
      getUserUsageCredits(),
      listScheduledPosts(),
      getUploadLogs(),
    ]).then(([profile, posts, accounts, usageRow, scheduledPosts, uploadLogs]) => {
      if (!mounted) return
      setProfileName(profile?.display_name ?? "사용자")
      setRecentPosts(posts.map(mapPostToUi))
      setSocialAccounts(accounts.map(mapSocialAccountToUi))
      setUsage({
        used: usageRow.used_count,
        total:
          usageRow.plan_limit < 0
            ? usageRow.used_count + usageRow.bonus_count
            : usageRow.plan_limit + usageRow.bonus_count,
      })
      setScheduledCount(scheduledPosts.length)
      setFailedCount(uploadLogs.filter((log) => log.status === "failed").length)
    })
    loadDashboard()
    window.addEventListener(MOCK_DB_CHANGED_EVENT, loadDashboard)
    return () => {
      mounted = false
      window.removeEventListener(MOCK_DB_CHANGED_EVENT, loadDashboard)
    }
  }, [])

  const connectedCount = socialAccounts.filter((acc) => acc.status === "connected").length
  const expiredCount = socialAccounts.filter((acc) => acc.status === "expired").length

  const stats = [
    {
      icon: PlugZap,
      label: "연결된 SNS 계정",
      value: String(connectedCount),
      suffix: "개",
      sub: `전체 ${socialAccounts.length}개 중 · ${expiredCount}개 재인증 필요`,
      trend: null,
    },
    {
      icon: CalendarClock,
      label: "예약된 게시물",
      value: String(scheduledCount),
      suffix: "개",
      sub: "이번 주 예정",
      trend: { dir: "up" as const, value: "+2", label: "지난 주 대비" },
    },
    {
      icon: Eye,
      label: "이번 달 노출",
      value: "24.8K",
      suffix: "",
      sub: "5개 플랫폼 합산",
      trend: { dir: "up" as const, value: "+18%", label: "전월 대비" },
    },
    {
      icon: AlertTriangle,
      label: "실패한 업로드",
      value: String(failedCount),
      suffix: "개",
      sub: failedCount > 0 ? "확인이 필요합니다" : "모두 정상입니다",
      danger: failedCount > 0,
      trend: { dir: "down" as const, value: "-50%", label: "지난 주 대비" },
    },
  ]

  return (
    <>
      <PageHeader
        title={`안녕하세요, ${profileName}님`}
        description="오늘의 운영 현황과 예약된 게시물을 한눈에 확인하세요."
        action={
          <Button
            asChild
            className="brand-gradient press-effect w-full text-primary-foreground shadow-sm hover:opacity-95 hover:shadow-md sm:w-auto"
          >
            <Link href="/dashboard/posts/new">
              <Plus className="h-4 w-4" />새 게시물
            </Link>
          </Button>
        }
      />

      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* Top: Counter + Stats */}
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <WeeklyUploadCounter used={usage.used} total={usage.total} variant="card" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((s, i) => (
              <Card
                key={i}
                className="card-hover border-border/80 shadow-sm hover:border-primary/20 hover:shadow-md"
              >
                <CardContent className="flex flex-col gap-3 p-5">
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "inline-flex h-9 w-9 items-center justify-center rounded-lg",
                        s.danger
                          ? "bg-destructive/10 text-destructive"
                          : "bg-primary/10 text-primary",
                      )}
                    >
                      <s.icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    {s.trend && (
                      <span
                        className={cn(
                          "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                          s.trend.dir === "up"
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                            : "bg-destructive/10 text-destructive",
                        )}
                      >
                        {s.trend.dir === "up" ? (
                          <TrendingUp className="h-2.5 w-2.5" aria-hidden="true" />
                        ) : (
                          <TrendingDown className="h-2.5 w-2.5" aria-hidden="true" />
                        )}
                        {s.trend.value}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold tracking-tight text-foreground">
                      {s.value}
                    </span>
                    <span className="text-sm text-muted-foreground">{s.suffix}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{s.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Two col: Recent posts + Account health */}
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <Card className="border-border/80 shadow-sm">
            <CardContent className="p-0">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div>
                  <h2 className="text-base font-bold text-foreground">최근 게시물</h2>
                  <p className="text-xs text-muted-foreground">최근 작업한 게시물 6건</p>
                </div>
                <Button asChild variant="ghost" size="sm" className="press-effect gap-1">
                  <Link href="/dashboard/posts/history">
                    전체 보기 <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>게시물 제목</TableHead>
                      <TableHead>플랫폼</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead className="hidden md:table-cell">예약 시간</TableHead>
                      <TableHead className="w-12 text-right">액션</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentPosts.map((p) => (
                      <TableRow key={p.id} className="transition-colors hover:bg-secondary/40">
                        <TableCell className="max-w-[280px]">
                          <span className="line-clamp-1 font-medium text-foreground">
                            {p.title}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex -space-x-1.5">
                            {p.platforms.map((pl) => (
                              <PlatformIcon
                                key={pl}
                                platform={pl}
                                size="sm"
                                className="ring-2 ring-card transition-transform hover:z-10 hover:scale-110"
                              />
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={p.status} />
                        </TableCell>
                        <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                          {p.scheduledAt ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 press-effect"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">액션</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>편집</DropdownMenuItem>
                              <DropdownMenuItem>복제</DropdownMenuItem>
                              <DropdownMenuItem>다시 시도</DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive">
                                삭제
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-sm">
            <CardContent className="p-0">
              <div className="border-b border-border px-5 py-4">
                <h2 className="text-base font-bold text-foreground">계정 상태</h2>
                <p className="text-xs text-muted-foreground">연결된 SNS 채널을 확인하세요.</p>
              </div>
              <ul className="divide-y divide-border">
                {socialAccounts.map((acc) => (
                  <li
                    key={acc.platform}
                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-secondary/40"
                  >
                    <PlatformIcon platform={acc.platform} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground capitalize">
                        {acc.platform === "x" ? "X" : acc.platform}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {acc.handle ?? "연결되지 않음"}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "h-2 w-2 shrink-0 rounded-full",
                        acc.status === "connected"
                          ? "bg-emerald-500"
                          : acc.status === "expired"
                            ? "bg-destructive animate-pulse-ring"
                            : "bg-muted-foreground/40",
                      )}
                      aria-label={
                        acc.status === "connected"
                          ? "연결됨"
                          : acc.status === "expired"
                            ? "권한 만료"
                            : "연결 필요"
                      }
                    />
                  </li>
                ))}
              </ul>
              <div className="border-t border-border p-3">
                <Button asChild variant="outline" size="sm" className="press-effect w-full">
                  <Link href="/dashboard/accounts">계정 관리</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
