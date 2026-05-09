"use client"

import { useMemo, useRef, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { PlatformIcon, PLATFORM_NAMES } from "@/components/platform-icon"
import { WeeklyUploadCounter } from "@/components/app/weekly-upload-counter"
import {
  createPost as createMockPost,
  CURRENT_USER,
  PLATFORMS,
  recordWeeklyUpload,
  schedulePost as scheduleMockPost,
  type Platform,
} from "@/lib/db"
import {
  markMyPostMediaPendingDelete,
  uploadPostMediaAssets,
  validatePostMediaFile,
} from "@/lib/supabase/media-assets"
import { createSupabasePost } from "@/lib/supabase/posts"
import { publishMySupabasePostNow } from "@/lib/supabase/publish"
import {
  getMyUsageCredits,
  hasAvailableUploadCredit,
} from "@/lib/supabase/usage-credits"
import {
  Save,
  Send,
  CalendarClock,
  Image as ImageIcon,
  X as XIcon,
  Hash,
  Smile,
  Wand2,
  Info,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Trash2,
  Eye,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  YOUTUBE_PRIVACY_OPTIONS,
  type YouTubePrivacyStatus,
} from "@/lib/youtube/privacy"

const HASHTAG_SETS = [
  { name: "브랜드 기본", tags: "#postbridge #브랜드 #콘텐츠마케팅" },
  { name: "신제품 출시", tags: "#newrelease #신제품 #출시 #런칭" },
  { name: "이벤트", tags: "#이벤트 #event #경품 #추첨" },
]

type MediaItem = {
  id: string
  name: string
  size: number
  type: string
  url: string
  file: File
}

export function PostComposer({
  youtubeDefaultPrivacyStatus = "private",
}: {
  youtubeDefaultPrivacyStatus?: YouTubePrivacyStatus
}) {
  const [title, setTitle] = useState("")
  const [body, setBody] = useState(
    "오늘 새 메뉴가 출시되었습니다 ☕️\n9월 한정으로 만나보실 수 있어요.\n\n많은 관심 부탁드립니다!",
  )
  const [hashtags, setHashtags] = useState("#newmenu #autumnvibes #postbridge")
  const [selected, setSelected] = useState<Set<Platform>>(
    new Set(["instagram", "facebook"]),
  )
  const [youtubePrivacyStatus, setYouTubePrivacyStatus] =
    useState<YouTubePrivacyStatus>(youtubeDefaultPrivacyStatus)
  const [media, setMedia] = useState<MediaItem[]>([])
  const [isPosting, setIsPosting] = useState(false)
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const totalChars = body.length + (hashtags ? hashtags.length + 1 : 0)
  const selectedPlatforms = useMemo(
    () => PLATFORMS.filter((p) => selected.has(p.id)),
    [selected],
  )
  const minLimit = useMemo(() => {
    if (selectedPlatforms.length === 0) return 5000
    return Math.min(...selectedPlatforms.map((p) => p.charLimit))
  }, [selectedPlatforms])

  const exceedsLimit = totalChars > minLimit
  const noPlatform = selected.size === 0
  const canPost = !exceedsLimit && !noPlatform && body.trim().length > 0

  const toggle = (id: Platform) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    const remainingSlots = 10 - media.length

    if (remainingSlots <= 0) {
      toast.error("미디어는 최대 10개까지 추가할 수 있습니다.")
      return
    }

    const selectedFiles = Array.from(files)

    if (selectedFiles.length > remainingSlots) {
      toast.error(`최대 10개까지 추가할 수 있어 ${remainingSlots}개만 선택됩니다.`)
    }

    const errors: string[] = []
    const items: MediaItem[] = selectedFiles.slice(0, remainingSlots).flatMap((file) => {
      try {
        validatePostMediaFile(file)

        return [{
          id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          size: file.size,
          type: file.type,
          url: URL.createObjectURL(file),
          file,
        }]
      } catch (error) {
        errors.push(error instanceof Error ? error.message : `${file.name}: 업로드할 수 없습니다.`)
        return []
      }
    })

    setMedia((m) => [...m, ...items])
    if (items.length > 0) toast.success(`${items.length}개 파일이 추가되었습니다.`)
    errors.forEach((message) => toast.error(message))
  }

  const removeMedia = (id: string) => {
    setMedia((m) => {
      const item = m.find((x) => x.id === id)

      if (item) {
        URL.revokeObjectURL(item.url)
      }

      return m.filter((x) => x.id !== id)
    })
  }

  const buildPostInput = () => ({
    title:
      title.trim() ||
      body
        .trim()
        .split(/\s+/)
        .slice(0, 8)
        .join(" ")
        .slice(0, 60) ||
      "제목 없는 게시물",
    content: [body.trim(), hashtags.trim()].filter(Boolean).join("\n\n"),
    platforms: Array.from(selected),
    platform_settings: selected.has("youtube")
      ? { youtube: { privacyStatus: youtubePrivacyStatus } }
      : {},
    media_urls: media.map((item) => item.url),
  })

  const handleSaveDraft = async () => {
    if (isSavingDraft) return
    setIsSavingDraft(true)
    try {
      const input = buildPostInput()
      const supabasePost = await createSupabasePost({
        title: input.title,
        content: input.content,
        platforms: input.platforms,
        platformSettings: input.platform_settings,
        status: "draft",
      })
      await uploadSelectedMedia(supabasePost.id)
      await createMockPost(CURRENT_USER, input)
      toast.success("임시저장되었습니다.", {
        description: "Supabase posts 테이블에 draft로 저장되었습니다.",
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "임시저장에 실패했습니다.")
    } finally {
      setIsSavingDraft(false)
    }
  }

  const handlePostNow = async () => {
    if (!canPost) {
      if (noPlatform) toast.error("플랫폼을 1개 이상 선택해 주세요.")
      else if (exceedsLimit)
        toast.error(`글자 수가 한도를 초과했습니다. (${totalChars}/${minLimit})`)
      else toast.error("본문을 작성해 주세요.")
      return
    }

    const supabaseUsage = await getMyUsageCredits().catch(() => null)

    if (supabaseUsage && !hasAvailableUploadCredit(supabaseUsage)) {
      toast.error("무료 업로드 횟수를 모두 사용했습니다")
      return
    }

    setIsPosting(true)
    const id = toast.loading(`${selected.size}개 플랫폼에 업로드 중...`, {
      description: "잠시만 기다려 주세요.",
    })
    const input = buildPostInput()
    try {
      const supabasePost = await createSupabasePost({
        title: input.title,
        content: input.content,
        platforms: input.platforms,
        platformSettings: input.platform_settings,
        status: "draft",
      })
      await uploadSelectedMedia(supabasePost.id)
      const publishResult = await publishMySupabasePostNow(supabasePost.id)

      if (!supabaseUsage) {
        await createMockPost(CURRENT_USER, input)
        await recordWeeklyUpload(CURRENT_USER, 1)
      }

      if (publishResult.status === "failed") {
        throw new Error(
          publishResult.results
            .filter((result) => result.status === "failed")
            .map((result) => `${result.platform}: ${result.errorMessage}`)
            .join("; ") || "?낅줈?쒖뿉 ?ㅽ뙣?덉뒿?덈떎.",
        )
      }

      const published = { platforms: input.platforms }
      toast.success(`${published.platforms.length}개 플랫폼에 업로드를 시작했습니다.`, {
        id,
        description: supabaseUsage
          ? "이번 주 무료 업로드 횟수가 1회 차감되었습니다."
          : "사용 횟수와 업로드 기록이 mock 데이터에 반영되었습니다.",
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "업로드에 실패했습니다."
      /* legacy mock failure handling moved to /api/uploads/publish
      const failedPlatforms = getMockFailedPlatforms(message, input.platforms)

      const supabaseLogs = await recordMyMockUploadResult({
        title: input.title,
        content: input.content,
        platforms: input.platforms,
        failedPlatforms,
        failReason: message,
      }).catch(() => null)
      await stageImmediateUploadMediaForCleanup(
        supabaseLogs?.[0]?.post_id,
        72 * 60 * 60 * 1000,
      )
      */

      toast.error(error instanceof Error ? error.message : "업로드에 실패했습니다.", {
        id,
        description: "연결되지 않은 플랫폼을 선택하면 실패 로그가 mock으로 생성됩니다.",
      })
    } finally {
      setIsPosting(false)
    }
  }

  function getMockFailedPlatforms(message: string, platforms: Platform[]) {
    const marker = "연결 필요:"
    const markerIndex = message.indexOf(marker)

    if (markerIndex === -1) {
      return platforms
    }

    const failed = message
      .slice(markerIndex + marker.length)
      .split(",")
      .map((platform) => platform.trim())

    return platforms.filter((platform) => failed.includes(platform))
  }

  async function stageImmediateUploadMediaForCleanup(
    postId: string | undefined,
    cleanupDelayMs: number,
  ) {
    if (!postId || media.length === 0) {
      return
    }

    try {
      const deleteAfter = new Date(Date.now() + cleanupDelayMs)
      const uploadedCount = await uploadSelectedMedia(postId, {
        status: "pending_delete",
        deleteAfter,
      })

      if (uploadedCount > 0) {
        await markMyPostMediaPendingDelete(postId, deleteAfter)
      }
    } catch {
      // Storage is only temporary staging. Actual removal is handled later by
      // a service_role cleanup worker or server route, never by the browser.
    }
  }

  const handleSchedulePost = async (scheduledAt: string) => {
    const input = buildPostInput()
    const supabasePost = await createSupabasePost({
      title: input.title,
      content: input.content,
      platforms: input.platforms,
      platformSettings: input.platform_settings,
      status: "scheduled",
      scheduledAt,
    })
    await uploadSelectedMedia(supabasePost.id)
    const post = await createMockPost(CURRENT_USER, input)
    await scheduleMockPost(post.id, scheduledAt)
  }

  const uploadSelectedMedia = async (
    postId: string,
    cleanup?: { status: "pending_delete"; deleteAfter: Date },
  ) => {
    const files = media.map((item) => item.file)

    if (files.length === 0) {
      return 0
    }

    const toastId = toast.loading(`${files.length}개 미디어를 업로드하는 중입니다.`)

    try {
      const assets = await uploadPostMediaAssets({
        postId,
        files,
        status: cleanup?.status,
        deleteAfter: cleanup?.deleteAfter,
      })

      toast.success(`${assets.length}개 미디어가 업로드되었습니다.`, {
        id: toastId,
        description: "Supabase Storage와 media_assets에 연결되었습니다.",
      })
      return assets.length
    } catch (error) {
      toast.error("미디어 업로드에 실패했습니다", {
        id: toastId,
        description: error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요.",
      })
      throw error
    }
  }

  const insertHashtagSet = (tags: string) => {
    setHashtags((cur) => (cur ? `${cur} ${tags}` : tags))
    toast.success("해시태그 세트가 추가되었습니다.")
  }

  const aiPolish = () => {
    const id = toast.loading("AI가 본문을 다듬는 중...")
    setTimeout(() => {
      setBody(
        (b) =>
          b.trim() +
          (b.endsWith("!") ? "" : "!") +
          "\n\n✨ 지금 바로 확인해 보세요 →",
      )
      toast.success("본문이 자연스럽게 다듬어졌습니다.", { id })
    }, 800)
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="grid gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_400px] lg:px-8">
        {/* Composer */}
        <div className="space-y-6">
          {/* Mobile-only counter */}
          <div className="lg:hidden">
            <WeeklyUploadCounter variant="card" />
          </div>

          <Card className="border-border/80 shadow-sm">
            <CardContent className="p-5 sm:p-6">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="title">제목</FieldLabel>
                  <Input
                    id="title"
                    placeholder="게시물 제목을 입력하세요 (선택)"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                  <FieldDescription>
                    YouTube 제목, 또는 다른 플랫폼의 첫 줄로 사용됩니다.
                  </FieldDescription>
                </Field>

                <Field>
                  <div className="flex items-center justify-between">
                    <FieldLabel htmlFor="body">본문 내용</FieldLabel>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={aiPolish}
                      className="press-effect h-7 gap-1.5 px-2 text-xs text-primary hover:bg-primary/10 hover:text-primary"
                    >
                      <Wand2 className="h-3.5 w-3.5" /> AI로 다듬기
                    </Button>
                  </div>
                  <Textarea
                    id="body"
                    rows={8}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="공유하고 싶은 내용을 작성하세요..."
                    className="resize-y"
                    aria-invalid={exceedsLimit}
                  />
                  <CharCounter
                    current={totalChars}
                    limit={minLimit}
                    selected={selectedPlatforms}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="hashtags" className="flex items-center gap-1.5">
                    <Hash className="h-3.5 w-3.5" /> 해시태그
                  </FieldLabel>
                  <Input
                    id="hashtags"
                    value={hashtags}
                    onChange={(e) => setHashtags(e.target.value)}
                    placeholder="#예시 #브랜드"
                  />
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    <span className="text-xs text-muted-foreground">자주 쓰는 세트:</span>
                    {HASHTAG_SETS.map((s) => (
                      <button
                        key={s.name}
                        type="button"
                        onClick={() => insertHashtagSet(s.tags)}
                        className="press-effect inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-medium text-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                      >
                        + {s.name}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field>
                  <FieldLabel>이미지 / 영상</FieldLabel>
                  <DropZone
                    onFiles={handleFiles}
                    onClick={() => fileInputRef.current?.click()}
                    full={media.length >= 10}
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
                    className="hidden"
                    onChange={(e) => {
                      handleFiles(e.target.files)
                      e.currentTarget.value = ""
                    }}
                  />
                  {media.length > 0 && (
                    <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {media.map((m) => (
                        <MediaThumb key={m.id} item={m} onRemove={() => removeMedia(m.id)} />
                      ))}
                    </div>
                  )}
                </Field>

                <FieldSet>
                  <div className="flex items-center justify-between">
                    <FieldLegend>플랫폼 선택</FieldLegend>
                    <span className="text-xs font-semibold text-muted-foreground">
                      {selected.size} / 5
                    </span>
                  </div>
                  <FieldDescription>
                    이 게시물을 게시할 플랫폼을 선택하세요. 가장 짧은 글자 수 제한이 적용됩니다.
                  </FieldDescription>
                  <FieldGroup className="mt-1 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {PLATFORMS.map((p) => {
                      const checked = selected.has(p.id)
                      const overByThis = totalChars > p.charLimit
                      return (
                        <button
                          key={p.id}
                          type="button"
                          aria-pressed={checked}
                          onClick={() => toggle(p.id)}
                          className={cn(
                            "press-effect group flex items-start gap-3 rounded-xl border p-3 text-left transition-all",
                            checked
                              ? "border-primary/50 bg-primary/5 shadow-sm ring-1 ring-primary/20"
                              : "border-border bg-card hover:-translate-y-0.5 hover:border-border/80 hover:bg-secondary/50 hover:shadow-sm",
                          )}
                        >
                          <PlatformIcon platform={p.id} size="md" className="shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-semibold text-foreground">{p.name}</p>
                              {checked && overByThis && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <AlertTriangle
                                      className="h-3 w-3 shrink-0 text-destructive"
                                      aria-label="글자 수 초과"
                                    />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {p.charLimit}자를 {totalChars - p.charLimit}자 초과
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              최대 {p.charLimit.toLocaleString()}자
                            </p>
                          </div>
                          <span
                            className={cn(
                              "mt-0.5 h-4 w-4 shrink-0 rounded-md border transition-colors",
                              checked
                                ? "border-primary bg-primary"
                                : "border-border bg-card group-hover:border-primary/40",
                            )}
                            aria-hidden="true"
                          >
                            {checked && (
                              <CheckCircle2 className="h-4 w-4 text-primary-foreground" strokeWidth={3} />
                            )}
                          </span>
                        </button>
                      )
                    })}
                  </FieldGroup>
                </FieldSet>

                {selected.has("youtube") && (
                  <FieldSet>
                    <div className="flex items-center justify-between gap-3">
                      <FieldLegend>YouTube 공개 설정</FieldLegend>
                      <PlatformIcon platform="youtube" size="sm" />
                    </div>
                    <FieldDescription>
                      테스트 중에는 비공개 업로드를 권장합니다.
                    </FieldDescription>
                    <Select
                      value={youtubePrivacyStatus}
                      onValueChange={(value) =>
                        setYouTubePrivacyStatus(value as YouTubePrivacyStatus)
                      }
                    >
                      <SelectTrigger className="mt-1 w-full sm:w-56">
                        <SelectValue placeholder="공개 설정 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {YOUTUBE_PRIVACY_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FieldSet>
                )}
              </FieldGroup>

              {/* Action bar */}
              <div className="mt-7 flex flex-col gap-2 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    각 플랫폼별 미리보기는 우측에서 확인하세요.
                  </span>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    variant="outline"
                    onClick={handleSaveDraft}
                    disabled={isSavingDraft}
                    className="press-effect gap-2"
                  >
                    {isSavingDraft ? <Spinner className="size-4" /> : <Save className="h-4 w-4" />}
                    임시저장
                  </Button>
                  <ScheduleDialog disabled={!canPost} onConfirm={handleSchedulePost} />
                  <Button
                    onClick={handlePostNow}
                    disabled={isPosting || !canPost}
                    className="brand-gradient press-effect gap-2 text-primary-foreground shadow-sm hover:opacity-95 hover:shadow-md disabled:opacity-50"
                  >
                    {isPosting ? (
                      <>
                        <Spinner className="size-4" /> 업로드 중...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" /> 지금 업로드
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview */}
        <PreviewPanel
          title={title}
          body={body}
          hashtags={hashtags}
          platforms={Array.from(selected)}
          totalChars={totalChars}
          minLimit={minLimit}
          mediaUrl={media[0]?.url}
          mediaType={media[0]?.type}
        />
      </div>
    </TooltipProvider>
  )
}

/* -------------------------- Char counter -------------------------- */

function CharCounter({
  current,
  limit,
  selected,
}: {
  current: number
  limit: number
  selected: { id: Platform; name: string; charLimit: number }[]
}) {
  const pct = Math.min((current / limit) * 100, 100)
  const overall = current > limit
  const tone =
    pct > 100 ? "destructive" : pct > 90 ? "warning" : "default"

  return (
    <div className="space-y-2 pt-1">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <span>본문 + 해시태그</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-[260px] text-xs">
              선택된 플랫폼 중 가장 짧은 글자 수 한도를 기준으로 표시됩니다.
            </TooltipContent>
          </Tooltip>
        </div>
        <span
          className={cn(
            "font-semibold tabular-nums",
            tone === "destructive" && "text-destructive",
            tone === "warning" && "text-amber-600 dark:text-amber-400",
            tone === "default" && "text-foreground",
          )}
        >
          {current.toLocaleString()} / {limit.toLocaleString()}
        </span>
      </div>
      <Progress
        value={Math.min(pct, 100)}
        className={cn(
          "h-1.5",
          tone === "destructive" && "[&>div]:bg-destructive",
          tone === "warning" && "[&>div]:bg-amber-500",
        )}
      />
      {/* Per-platform mini limits */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {selected.map((p) => {
            const over = current > p.charLimit
            const pPct = Math.min((current / p.charLimit) * 100, 100)
            const remaining = p.charLimit - current
            return (
              <Tooltip key={p.id}>
                <TooltipTrigger asChild>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                      over
                        ? "border-destructive/30 bg-destructive/10 text-destructive"
                        : pPct > 90
                          ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                          : "border-border bg-card text-muted-foreground",
                    )}
                  >
                    <PlatformIcon platform={p.id} size="sm" className="h-3.5 w-3.5 rounded-sm" />
                    {over ? `−${Math.abs(remaining)}` : remaining.toLocaleString()}
                  </span>
                </TooltipTrigger>
                <TooltipContent className="text-xs">
                  {p.name} 한도 {p.charLimit.toLocaleString()}자 ·{" "}
                  {over
                    ? `${Math.abs(remaining)}자 초과`
                    : `${remaining.toLocaleString()}자 남음`}
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      )}
      {overall && (
        <p className="flex items-center gap-1 text-xs font-medium text-destructive">
          <AlertTriangle className="h-3 w-3" /> 가장 짧은 플랫폼 한도를 초과했습니다.
        </p>
      )}
    </div>
  )
}

/* -------------------------- Drop zone -------------------------- */

function DropZone({
  onFiles,
  onClick,
  full,
}: {
  onFiles: (f: FileList | null) => void
  onClick: () => void
  full: boolean
}) {
  const [dragOver, setDragOver] = useState(false)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => {
        if (!full) onClick()
      }}
      onKeyDown={(e) => {
        if (full) return
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onClick()
        }
      }}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        if (!full) onFiles(e.dataTransfer.files)
      }}
      aria-disabled={full}
      className={cn(
        "press-effect flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-all",
        dragOver
          ? "border-primary bg-primary/10 ring-4 ring-primary/10"
          : "border-border bg-secondary/40 hover:border-primary/40 hover:bg-primary/5",
        full && "cursor-not-allowed opacity-50",
      )}
    >
      <span
        className={cn(
          "inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors",
          dragOver ? "brand-gradient text-primary-foreground" : "bg-primary/10 text-primary",
        )}
      >
        <ImageIcon className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="text-sm font-medium text-foreground">
        {full ? "최대 10개까지 업로드 가능" : "파일을 끌어다 놓거나 클릭해서 업로드"}
      </p>
      <p className="text-xs text-muted-foreground">
        JPG · PNG · WebP 최대 10MB, MP4 · MOV · WebM 최대 300MB
      </p>
    </div>
  )
}

function MediaThumb({ item, onRemove }: { item: MediaItem; onRemove: () => void }) {
  const isVideo = item.type.startsWith("video")
  return (
    <div className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-secondary">
      {isVideo ? (
        <video src={item.url} className="h-full w-full object-cover" muted />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.url} alt={item.name} className="h-full w-full object-cover" />
      )}
      <div className="absolute inset-0 bg-foreground/0 transition-colors group-hover:bg-foreground/30" />
      <button
        type="button"
        onClick={onRemove}
        className="press-effect absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-md bg-background/90 text-foreground opacity-0 shadow-sm ring-1 ring-border backdrop-blur transition-opacity group-hover:opacity-100"
        aria-label={`${item.name} 제거`}
      >
        <Trash2 className="h-3 w-3" />
      </button>
      {isVideo && (
        <span className="absolute bottom-1 left-1 rounded bg-foreground/80 px-1 py-0.5 text-[9px] font-bold uppercase text-background">
          VIDEO
        </span>
      )}
    </div>
  )
}

/* -------------------------- Schedule dialog -------------------------- */

function ScheduleDialog({
  disabled,
  onConfirm,
}: {
  disabled?: boolean
  onConfirm: (scheduledAt: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState("2026-05-01")
  const [time, setTime] = useState("09:00")
  const [submitting, setSubmitting] = useState(false)

  const onConfirmSchedule = async () => {
    setSubmitting(true)
    try {
      const scheduledAt = new Date(`${date}T${time}:00`).toISOString()
      await onConfirm(scheduledAt)
      setSubmitting(false)
      setOpen(false)
      toast.success("예약이 확정되었습니다.", {
        description: `${date} ${time} 예약 게시물 페이지에서 확인할 수 있습니다.`,
      })
    } catch (error) {
      setSubmitting(false)
      toast.error(error instanceof Error ? error.message : "예약에 실패했습니다.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="press-effect gap-2" disabled={disabled}>
          <CalendarClock className="h-4 w-4" /> 예약하기
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>예약 업로드 설정</DialogTitle>
          <DialogDescription>
            게시물을 자동으로 발행할 날짜와 시간을 선택하세요.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sched-date">날짜</Label>
              <Input
                id="sched-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sched-time">시간</Label>
              <Input
                id="sched-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs text-muted-foreground">빠른 선택:</span>
            {[
              { label: "1시간 후", h: 1 },
              { label: "내일 9시", t: "tomorrow9" as const },
              { label: "다음 주 월요일", t: "nextMon" as const },
            ].map((q) => (
              <button
                key={q.label}
                type="button"
                onClick={() => {
                  const d = new Date()
                  if ("h" in q && q.h) d.setHours(d.getHours() + q.h)
                  if (q.t === "tomorrow9") {
                    d.setDate(d.getDate() + 1)
                    d.setHours(9, 0, 0, 0)
                  }
                  if (q.t === "nextMon") {
                    d.setDate(d.getDate() + ((1 + 7 - d.getDay()) % 7 || 7))
                    d.setHours(9, 0, 0, 0)
                  }
                  setDate(d.toISOString().slice(0, 10))
                  setTime(d.toTimeString().slice(0, 5))
                }}
                className="press-effect rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-medium text-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
              >
                {q.label}
              </button>
            ))}
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
            <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            예약된 시간 5분 전부터 업로드 큐가 시작되며, 실패 시 최대 3회까지 자동 재시도합니다.
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={onConfirmSchedule}
            disabled={submitting}
            className="brand-gradient press-effect w-full text-primary-foreground hover:opacity-95"
          >
            {submitting ? (
              <>
                <Spinner className="size-4" /> 예약 중...
              </>
            ) : (
              "예약 확정"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* -------------------------- Preview panel -------------------------- */

function PreviewPanel({
  title,
  body,
  hashtags,
  platforms,
  totalChars,
  minLimit,
  mediaUrl,
  mediaType,
}: {
  title: string
  body: string
  hashtags: string
  platforms: Platform[]
  totalChars: number
  minLimit: number
  mediaUrl?: string
  mediaType?: string
}) {
  const [activeTab, setActiveTab] = useState<Platform | "all">(platforms[0] ?? "all")
  const visiblePlatform = platforms.includes(activeTab as Platform)
    ? (activeTab as Platform)
    : platforms[0] ?? "instagram"

  return (
    <div className="lg:sticky lg:top-20 lg:h-fit">
      <Card className="border-border/80 shadow-sm">
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5 text-muted-foreground" />
              <h3 className="text-sm font-bold text-foreground">미리보기</h3>
            </div>
            <span
              className={cn(
                "text-xs font-semibold tabular-nums",
                totalChars > minLimit ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {totalChars.toLocaleString()} / {minLimit.toLocaleString()}자
            </span>
          </div>

          {/* Platform tabs */}
          {platforms.length > 0 ? (
            <div className="-mx-1 mt-3 flex gap-1 overflow-x-auto pb-1">
              {platforms.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setActiveTab(p)}
                  aria-pressed={visiblePlatform === p}
                  className={cn(
                    "press-effect inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors",
                    visiblePlatform === p
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  <PlatformIcon platform={p} size="sm" className="h-4 w-4 rounded-sm" />
                  {p === "x" ? "X" : PLATFORM_NAMES[p]}
                </button>
              ))}
            </div>
          ) : null}

          <PreviewCard
            title={title}
            body={body}
            hashtags={hashtags}
            platform={visiblePlatform}
            mediaUrl={mediaUrl}
            mediaType={mediaType}
          />

          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              선택된 플랫폼 ({platforms.length})
            </p>
            {platforms.length === 0 ? (
              <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground">
                <XIcon className="h-3.5 w-3.5" /> 플랫폼을 1개 이상 선택해 주세요.
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {platforms.map((p) => (
                  <div
                    key={p}
                    className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1"
                  >
                    <PlatformIcon platform={p} size="sm" className="h-4 w-4 rounded-md" />
                    <span className="text-xs font-semibold capitalize text-foreground">
                      {p === "x" ? "X" : p}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function PreviewCard({
  title,
  body,
  hashtags,
  platform,
  mediaUrl,
  mediaType,
}: {
  title: string
  body: string
  hashtags: string
  platform: Platform
  mediaUrl?: string
  mediaType?: string
}) {
  // Style varies subtly by platform for realism
  const isX = platform === "x"
  const isYT = platform === "youtube"

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-border bg-background">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3">
        <span className="brand-gradient h-9 w-9 rounded-full" aria-hidden="true" />
        <div className="flex-1">
          <div className="flex items-center gap-1">
            <p className="text-sm font-bold text-foreground">PostBridge</p>
            {isX && <span className="text-xs text-muted-foreground">@postbridge</span>}
          </div>
          <p className="text-xs text-muted-foreground">
            {isX ? "방금" : "방금 · 공개"}
          </p>
        </div>
        <PlatformIcon platform={platform} size="sm" />
      </div>

      {/* Media */}
      <div className="aspect-[4/3] overflow-hidden border-y border-border bg-secondary/40">
        {mediaUrl && mediaType?.startsWith("video") ? (
          <video src={mediaUrl} className="h-full w-full object-cover" muted />
        ) : mediaUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaUrl} alt="첨부 이미지" className="h-full w-full object-cover" />
        ) : (
          <div className="brand-gradient flex h-full w-full items-center justify-center text-primary-foreground/80">
            <ImageIcon className="h-10 w-10 opacity-60" aria-hidden="true" />
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-4">
        {title && !isX && (
          <p className={cn("font-bold text-foreground", isYT ? "text-base" : "text-sm")}>
            {title}
          </p>
        )}
        <p
          className={cn(
            "whitespace-pre-line text-sm leading-relaxed text-foreground",
            title && !isX && "mt-1",
          )}
        >
          {body || "본문을 입력하면 여기에 표시됩니다."}
        </p>
        {hashtags && (
          <p className="mt-2 text-sm font-medium text-primary">{hashtags}</p>
        )}
      </div>

      {/* Action row */}
      <div className="flex items-center gap-4 border-t border-border bg-card/60 px-4 py-2.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Smile className="h-3.5 w-3.5" /> 좋아요
        </span>
        <span>댓글</span>
        <span>공유</span>
        <span className="ml-auto inline-flex items-center gap-1">
          <Loader2 className="h-3 w-3" />
          미리보기 모드
        </span>
      </div>
    </div>
  )
}
