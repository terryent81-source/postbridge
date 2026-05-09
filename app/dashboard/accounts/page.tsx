"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Check, Loader2, Plug, RefreshCw, Unplug } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/app/page-header"
import { PlatformIcon } from "@/components/platform-icon"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type AccountPlatform = "facebook" | "instagram" | "youtube" | "tiktok"
type MetaPlatform = "facebook" | "instagram"

type SocialAccount = {
  id: string
  platform: AccountPlatform
  status: "connected" | "needs_connection" | "expired" | "token_missing"
  handle: string | null
  description: string | null
  page_id: string | null
  page_name: string | null
  page_category: string | null
  page_tasks: string[] | null
  has_page_access_token: boolean
  instagram_business_account_id: string | null
  token_expires_at: string | null
  connected_at: string | null
  youtube_shorts_auto_hashtag: boolean
  youtube_shorts_hashtag_location: "title" | "description"
}

type MetaPage = {
  id: string
  name: string
  category?: string
  tasks?: string[]
  permission_warning?: string | null
  instagram_business_account?: {
    id: string
    username?: string
    name?: string
  }
}

type ErrorDetails = {
  step?: string
  status?: number
  type?: string
  code?: number
  error_subcode?: number
  fbtrace_id?: string
  message?: string
}

type ApiResponse<T> =
  | ({ ok: true } & T)
  | {
      ok: false
      error: string
      message?: string
      details?: ErrorDetails | string | null
    }

const ACCOUNT_PLATFORMS: AccountPlatform[] = ["facebook", "instagram", "youtube", "tiktok"]
const META_PLATFORMS: MetaPlatform[] = ["facebook", "instagram"]

const PLATFORM_NAMES: Record<AccountPlatform, string> = {
  facebook: "Facebook Page",
  instagram: "Instagram Business",
  youtube: "YouTube / Shorts",
  tiktok: "TikTok",
}

const STATUS_LABELS = {
  connected: "연결됨",
  expired: "토큰 만료",
  needs_connection: "다시 연결 필요",
  not_connected: "연결 안 됨",
}

type UiStatus = keyof typeof STATUS_LABELS

const STATUS_TONE: Record<UiStatus, string> = {
  connected: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  expired: "border-destructive/25 bg-destructive/10 text-destructive",
  needs_connection: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  not_connected: "border-border bg-muted text-muted-foreground",
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [pages, setPages] = useState<MetaPage[]>([])
  const [selectedPageId, setSelectedPageId] = useState("")
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [loadingPages, setLoadingPages] = useState(false)
  const [savingPage, setSavingPage] = useState(false)
  const [busy, setBusy] = useState<AccountPlatform | null>(null)

  const accountsByPlatform = useMemo(
    () => new Map(accounts.map((account) => [account.platform, account])),
    [accounts],
  )

  const loadAccounts = useCallback(async () => {
    setLoadingAccounts(true)

    try {
      const supabase = createBrowserSupabaseClient()
      const { data, error } = await supabase
        .from("social_accounts")
        .select(
          "id, platform, status, handle, description, page_id, page_name, page_category, page_tasks, has_page_access_token, instagram_business_account_id, token_expires_at, connected_at, youtube_shorts_auto_hashtag, youtube_shorts_hashtag_location",
        )
        .in("platform", ACCOUNT_PLATFORMS)
        .order("platform", { ascending: true })

      if (error) {
        throw error
      }

      setAccounts((data ?? []) as SocialAccount[])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "연결 계정을 불러오지 못했습니다.")
    } finally {
      setLoadingAccounts(false)
    }
  }, [])

  const loadPages = useCallback(async () => {
    setLoadingPages(true)

    try {
      const response = await fetch("/api/auth/meta/pages", { cache: "no-store" })
      const payload = (await response.json().catch(() => null)) as ApiResponse<{
        pages: MetaPage[]
      }> | null

      if (!response.ok || !payload?.ok) {
        throw new Error(formatApiError(payload, "Facebook Page 목록을 불러오지 못했습니다."))
      }

      const nextPages = payload.pages
      setPages(nextPages)
      setSelectedPageId((current) => current || nextPages[0]?.id || "")
    } catch (error) {
      setPages([])
      toast.error(error instanceof Error ? error.message : "Facebook Page 목록을 불러오지 못했습니다.")
    } finally {
      setLoadingPages(false)
    }
  }, [])

  useEffect(() => {
    loadAccounts()
  }, [loadAccounts])

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const metaStatus = searchParams.get("meta")
    const youtubeStatus = searchParams.get("youtube")
    const tiktokStatus = searchParams.get("tiktok")
    const error = searchParams.get("error")
    const errorCode = searchParams.get("error_code")
    const message = searchParams.get("message")

    if (metaStatus === "connected") {
      toast.success("Meta 계정 연결이 완료되었습니다. 사용할 Facebook Page를 선택해 주세요.")
      loadPages()
    }

    if (youtubeStatus === "connected") {
      toast.success("YouTube 채널 연결이 완료되었습니다.")
      loadAccounts()
    }

    if (tiktokStatus === "connected") {
      toast.success("TikTok 계정 연결이 완료되었습니다.")
      loadAccounts()
    }

    if (error) {
      toast.error([error, errorCode, message].filter(Boolean).join(" - "))
    }
  }, [loadAccounts, loadPages])

  const handleSavePage = async () => {
    if (!selectedPageId) {
      toast.error("Facebook Page를 선택해 주세요.")
      return
    }

    setSavingPage(true)

    try {
      const response = await fetch("/api/auth/meta/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId: selectedPageId }),
      })
      const payload = (await response.json().catch(() => null)) as ApiResponse<{
        accounts: unknown
      }> | null

      if (!response.ok || !payload?.ok) {
        throw new Error(formatApiError(payload, "Facebook Page 저장에 실패했습니다."))
      }

      await loadAccounts()
      toast.success("업로드에 사용할 Facebook Page를 저장했습니다.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Facebook Page 저장에 실패했습니다.")
    } finally {
      setSavingPage(false)
    }
  }

  const handleDisconnect = async (platform: AccountPlatform) => {
    setBusy(platform)

    try {
      const endpoint =
        platform === "youtube"
          ? "/api/auth/youtube/disconnect"
          : platform === "tiktok"
            ? "/api/auth/tiktok/disconnect"
          : "/api/auth/meta/disconnect"
      const response = await fetch(endpoint, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body:
          platform === "youtube" || platform === "tiktok"
            ? undefined
            : JSON.stringify({ platform }),
      })
      const payload = (await response.json().catch(() => null)) as ApiResponse<{
        account: unknown
      }> | null

      if (!response.ok || !payload?.ok) {
        throw new Error(formatApiError(payload, "연결 해제에 실패했습니다."))
      }

      await loadAccounts()
      toast.success(`${PLATFORM_NAMES[platform]} 연결을 해제했습니다.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "연결 해제에 실패했습니다.")
    } finally {
      setBusy(null)
    }
  }

  const updateYouTubeShortsSettings = async (
    autoHashtag: boolean,
    hashtagLocation: "title" | "description",
  ) => {
    setBusy("youtube")

    try {
      const response = await fetch("/api/auth/youtube/channel", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoHashtag, hashtagLocation }),
      })
      const payload = (await response.json().catch(() => null)) as ApiResponse<{
        account: SocialAccount
      }> | null

      if (!response.ok || !payload?.ok) {
        throw new Error(formatApiError(payload, "Shorts 설정 저장에 실패했습니다."))
      }

      await loadAccounts()
      toast.success("Shorts 설정을 저장했습니다.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Shorts 설정 저장에 실패했습니다.")
    } finally {
      setBusy(null)
    }
  }

  const selectedPage = pages.find((page) => page.id === selectedPageId)
  const youtubeAccount = accountsByPlatform.get("youtube")

  return (
    <>
      <PageHeader
        title="연결 계정"
        description="Meta 계정과 YouTube 채널을 연결하고 실제 업로드 준비 상태를 확인합니다."
      />

      <div className="space-y-6 px-4 py-6 sm:px-6">
        <Alert className="border-amber-500/30 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle>연결 안내</AlertTitle>
          <AlertDescription>
            YouTube Shorts는 세로 영상 사용을 권장합니다. 제목이나 설명에 #Shorts를 자동으로 붙일 수 있습니다.
            TikTok은 현재 mock 업로드 모드입니다.
          </AlertDescription>
        </Alert>

        <div className="flex flex-wrap gap-2">
          <Button className="gap-2" onClick={() => (window.location.href = "/api/auth/meta/start")}>
            <Plug className="h-4 w-4" />
            Facebook / Instagram 연결
          </Button>
          <Button className="gap-2" variant="outline" onClick={() => (window.location.href = "/api/auth/youtube/start")}>
            <Plug className="h-4 w-4" />
            YouTube 연결
          </Button>
          <Button className="gap-2" variant="outline" onClick={() => (window.location.href = "/api/auth/tiktok/start")}>
            <Plug className="h-4 w-4" />
            TikTok 연결
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            disabled={loadingPages}
            onClick={loadPages}
          >
            {loadingPages ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Page 목록 새로고침
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {loadingAccounts && (
            <div className="col-span-full flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              연결 상태를 불러오는 중입니다.
            </div>
          )}
          {ACCOUNT_PLATFORMS.map((platform) => {
            const account = accountsByPlatform.get(platform)
            const status = getUiStatus(account)
            const isBusy = busy === platform

            return (
              <Card key={platform} className="border-border/80 shadow-sm">
                <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                  <div className="flex items-center gap-3">
                    <PlatformIcon platform={platform} size="lg" />
                    <div>
                      <CardTitle className="text-base">{PLATFORM_NAMES[platform]}</CardTitle>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {account?.handle ?? account?.page_name ?? "연결된 계정 없음"}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className={cn("gap-1", STATUS_TONE[status])}>
                    {status === "connected" && <Check className="h-3 w-3" />}
                    {status === "expired" && <AlertTriangle className="h-3 w-3" />}
                    {STATUS_LABELS[status]}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>{account?.description ?? "아직 연결 정보가 없습니다."}</p>
                    {account?.page_id && <p>ID: {account.page_id}</p>}
                    {account?.page_category && <p>Category: {account.page_category}</p>}
                    {account?.page_tasks?.length ? (
                      <p>Tasks: {account.page_tasks.join(", ")}</p>
                    ) : null}
                    {META_PLATFORMS.includes(platform as MetaPlatform) && account?.page_id && !account.has_page_access_token && (
                      <p className="font-medium text-amber-700 dark:text-amber-300">
                        추가 Meta 권한 설정이 필요합니다. 현재는 Page 목록 조회만 가능합니다.
                      </p>
                    )}
                    {platform === "tiktok" && (
                      <p className="font-medium text-amber-700 dark:text-amber-300">
                        현재 TikTok은 mock 업로드 모드입니다. 실제 TikTok에는 게시되지 않습니다.
                      </p>
                    )}
                    {account?.instagram_business_account_id && (
                      <p>Instagram Business ID: {account.instagram_business_account_id}</p>
                    )}
                    {account?.token_expires_at && (
                      <p>토큰 만료: {formatDate(account.token_expires_at)}</p>
                    )}
                  </div>

                  {account && status !== "not_connected" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-destructive hover:text-destructive"
                      disabled={isBusy}
                      onClick={() => handleDisconnect(platform)}
                    >
                      {isBusy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Unplug className="h-3.5 w-3.5" />
                      )}
                      연결 해제
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Facebook Page 선택</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Meta 연결 후 Page 목록을 새로고침하면 선택 가능한 Facebook Page가 표시됩니다.
              </p>
            ) : (
              <>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Select value={selectedPageId} onValueChange={setSelectedPageId}>
                    <SelectTrigger className="w-full sm:w-80">
                      <SelectValue placeholder="Facebook Page 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {pages.map((page) => (
                        <SelectItem key={page.id} value={page.id}>
                          {page.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button className="gap-2" disabled={savingPage} onClick={handleSavePage}>
                    {savingPage && <Loader2 className="h-4 w-4 animate-spin" />}
                    선택한 Page 저장
                  </Button>
                </div>

                {selectedPage && (
                  <div className="rounded-md border bg-muted/30 p-4 text-sm">
                    <p className="font-medium">{selectedPage.name}</p>
                    <p className="mt-1 text-muted-foreground">Page ID: {selectedPage.id}</p>
                    {selectedPage.category && (
                      <p className="mt-1 text-muted-foreground">Category: {selectedPage.category}</p>
                    )}
                    {selectedPage.permission_warning && (
                      <p className="mt-2 font-medium text-amber-700 dark:text-amber-300">
                        {selectedPage.permission_warning}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">YouTube Shorts 옵션</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              Shorts 업로드에는 9:16 세로 영상 사용을 권장합니다. 자동 #Shorts 옵션은 실제 YouTube 업로드 시 제목 또는 설명에 태그를 보강합니다.
            </p>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={youtubeAccount?.youtube_shorts_auto_hashtag ?? true}
                disabled={!youtubeAccount || busy === "youtube"}
                onChange={(event) =>
                  updateYouTubeShortsSettings(
                    event.target.checked,
                    youtubeAccount?.youtube_shorts_hashtag_location ?? "description",
                  )
                }
              />
              #Shorts 자동 추가
            </label>
            <Select
              value={youtubeAccount?.youtube_shorts_hashtag_location ?? "description"}
              disabled={!youtubeAccount || busy === "youtube"}
              onValueChange={(value) =>
                updateYouTubeShortsSettings(
                  youtubeAccount?.youtube_shorts_auto_hashtag ?? true,
                  value === "title" ? "title" : "description",
                )
              }
            >
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="description">설명에 추가</SelectItem>
                <SelectItem value="title">제목에 추가</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function getUiStatus(account?: SocialAccount): UiStatus {
  if (!account) {
    return "not_connected"
  }

  if (account.token_expires_at && new Date(account.token_expires_at).getTime() < Date.now()) {
    return "expired"
  }

  if (account.status === "connected") {
    return "connected"
  }

  if (account.status === "token_missing" && account.page_id) {
    return "connected"
  }

  return "needs_connection"
}

function formatApiError(payload: ApiResponse<unknown> | null, fallback: string) {
  if (!payload || payload.ok) {
    return fallback
  }

  return [
    payload.error,
    payload.message,
    ...formatErrorDetails(payload.details),
  ]
    .filter(Boolean)
    .join(" - ")
}

function formatErrorDetails(details: ErrorDetails | string | null | undefined) {
  if (!details) {
    return []
  }

  if (typeof details === "string") {
    return [details]
  }

  return [
    details.step ? `step=${details.step}` : null,
    typeof details.status === "number" ? `status=${details.status}` : null,
    details.type ? `type=${details.type}` : null,
    typeof details.code === "number" ? `code=${details.code}` : null,
    typeof details.error_subcode === "number"
      ? `subcode=${details.error_subcode}`
      : null,
    details.fbtrace_id ? `fbtrace_id=${details.fbtrace_id}` : null,
    details.message ? `message=${details.message}` : null,
  ].filter(Boolean)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}
