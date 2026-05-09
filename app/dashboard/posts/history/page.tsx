"use client"

import { useEffect, useMemo, useState } from "react"
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
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { StatusBadge } from "@/components/app/status-badge"
import { PlatformIcon } from "@/components/platform-icon"
import { EmptyState } from "@/components/app/empty-state"
import {
  getPost,
  getUploadLogs,
  mapUploadLogToUi,
  MOCK_DB_CHANGED_EVENT,
  type UiUploadLog,
  type UploadStatus,
} from "@/lib/db"
import {
  listMySupabaseUploadLogsWithPosts,
  SUPABASE_UPLOAD_LOGS_CHANGED_EVENT,
} from "@/lib/supabase/upload-logs"
import { MEDIA_EXPIRED_MESSAGE } from "@/lib/supabase/media-assets"
import { hasDeletedMediaAssets } from "@/components/app/post-media-summary"
import { Download, ExternalLink, RotateCw, Search, FileX2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const UPLOAD_STATUS_LABELS: Record<UploadStatus, string> = {
  pending: "대기 중",
  success: "성공",
  failed: "실패",
}

const FILTERS: { id: "all" | UploadStatus; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "success", label: UPLOAD_STATUS_LABELS.success },
  { id: "failed", label: UPLOAD_STATUS_LABELS.failed },
  { id: "pending", label: UPLOAD_STATUS_LABELS.pending },
]

type HistoryUploadLog = UiUploadLog & {
  hasDeletedMedia?: boolean
}

export default function HistoryPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all")
  const [query, setQuery] = useState("")
  const [logs, setLogs] = useState<HistoryUploadLog[]>([])

  useEffect(() => {
    let mounted = true
    const loadLogs = async () => {
      const supabaseRows = await listMySupabaseUploadLogsWithPosts().catch(() => [])

      if (supabaseRows.length > 0) {
        if (mounted) {
          setLogs(
            supabaseRows.map(({ log, post, mediaAssets }) => ({
              ...mapUploadLogToUi(log, post),
              hasDeletedMedia: hasDeletedMediaAssets(mediaAssets),
            })),
          )
        }
        return
      }

      const rows = await getUploadLogs()
      const mapped = await Promise.all(
        rows.map(async (log) => mapUploadLogToUi(log, await getPost(log.post_id))),
      )
      if (mounted) setLogs(mapped)
    }
    loadLogs()
    window.addEventListener(MOCK_DB_CHANGED_EVENT, loadLogs)
    window.addEventListener(SUPABASE_UPLOAD_LOGS_CHANGED_EVENT, loadLogs)
    return () => {
      mounted = false
      window.removeEventListener(MOCK_DB_CHANGED_EVENT, loadLogs)
      window.removeEventListener(SUPABASE_UPLOAD_LOGS_CHANGED_EVENT, loadLogs)
    }
  }, [])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: logs.length }
    logs.forEach((p) => {
      c[p.status] = (c[p.status] ?? 0) + 1
    })
    return c
  }, [logs])

  const filtered = useMemo(() => {
    return logs.filter((p) => filter === "all" || p.status === filter).filter(
      (p) => !query || p.title.toLowerCase().includes(query.toLowerCase()),
    )
  }, [filter, logs, query])

  return (
    <>
      <PageHeader
        title="업로드 기록"
        description="모든 업로드의 성공·실패 이력을 추적하세요."
        action={
          <Button
            variant="outline"
            className="press-effect gap-2"
            onClick={() => toast.success("CSV 파일이 다운로드되었습니다.")}
          >
            <Download className="h-4 w-4" /> CSV 내보내기
          </Button>
        }
      />

      <div className="space-y-4 px-4 py-6 sm:px-6 lg:px-8">
        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="-mx-1 flex gap-1 overflow-x-auto pb-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                aria-pressed={filter === f.id}
                className={cn(
                  "press-effect inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                  filter === f.id
                    ? "bg-foreground text-background"
                    : "border border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label}
                {counts[f.id] !== undefined && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[10px]",
                      filter === f.id ? "bg-background/20" : "bg-muted",
                    )}
                  >
                    {counts[f.id]}
                  </span>
                )}
              </button>
            ))}
          </div>
          <InputGroup className="sm:max-w-xs">
            <InputGroupAddon align="inline-start">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="제목으로 검색..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </InputGroup>
        </div>

        <Card className="border-border/80 shadow-sm">
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <EmptyState
                variant="inline"
                icon={FileX2}
                title="검색 결과가 없습니다"
                description="필터를 변경하거나 검색어를 다르게 입력해 보세요."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>게시물</TableHead>
                      <TableHead>플랫폼</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead className="hidden md:table-cell">업로드 시간</TableHead>
                      <TableHead className="hidden lg:table-cell">실패 사유</TableHead>
                      <TableHead className="text-right">액션</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((p) => (
                      <TableRow key={p.id} className="transition-colors hover:bg-secondary/40">
                        <TableCell className="max-w-[260px]">
                          <span className="line-clamp-1 font-medium text-foreground">{p.title}</span>
                          <span className="line-clamp-1 text-xs text-muted-foreground md:hidden">
                            {p.attemptedAt}
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
                          <StatusBadge status={p.postStatus} />
                        </TableCell>
                        <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                          {p.attemptedAt}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {p.hasDeletedMedia ? (
                            <span className="text-sm font-medium text-destructive">
                              파일을 다시 업로드해 주세요.
                            </span>
                          ) : p.errorMessage ? (
                            <span className="text-sm font-medium text-destructive">
                              {p.errorMessage}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {p.youtubeUrl ? (
                            <div className="flex justify-end gap-2">
                              <Button
                                asChild
                                size="sm"
                                variant="outline"
                                className="press-effect gap-1.5"
                              >
                                <a
                                  href={p.youtubeUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                  YouTube에서 보기
                                </a>
                              </Button>
                              {p.youtubeStudioUrl && (
                                <Button
                                  asChild
                                  size="sm"
                                  variant="ghost"
                                  className="press-effect gap-1.5"
                                >
                                  <a
                                    href={p.youtubeStudioUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Studio
                                  </a>
                                </Button>
                              )}
                            </div>
                          ) : p.platform === "youtube" &&
                            p.status === "success" &&
                            p.uploadMode === "mock" ? (
                            <span className="text-xs text-muted-foreground">Mock 완료</span>
                          ) : p.status === "failed" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="press-effect gap-1.5"
                              disabled={p.hasDeletedMedia}
                              title={p.hasDeletedMedia ? MEDIA_EXPIRED_MESSAGE : undefined}
                              onClick={() => toast.success("재시도 큐에 추가되었습니다.")}
                            >
                              <RotateCw className="h-3.5 w-3.5" /> 재시도
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
