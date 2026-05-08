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

type MetaPlatform = "facebook" | "instagram"

type MetaAccount = {
  id: string
  platform: MetaPlatform
  status: "connected" | "needs_connection" | "expired"
  handle: string | null
  description: string | null
  page_id: string | null
  page_name: string | null
  instagram_business_account_id: string | null
  token_expires_at: string | null
  connected_at: string | null
  created_at: string
  updated_at: string
}

type MetaPage = {
  id: string
  name: string
  instagram_business_account?: {
    id: string
    username?: string
    name?: string
  }
}

const PLATFORMS: MetaPlatform[] = ["facebook", "instagram"]

const PLATFORM_NAMES: Record<MetaPlatform, string> = {
  facebook: "Facebook Page",
  instagram: "Instagram Business",
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
  const [accounts, setAccounts] = useState<MetaAccount[]>([])
  const [pages, setPages] = useState<MetaPage[]>([])
  const [selectedPageId, setSelectedPageId] = useState("")
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [loadingPages, setLoadingPages] = useState(false)
  const [savingPage, setSavingPage] = useState(false)
  const [disconnecting, setDisconnecting] = useState<MetaPlatform | null>(null)

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
          "id, platform, status, handle, description, page_id, page_name, instagram_business_account_id, token_expires_at, connected_at, created_at, updated_at",
        )
        .in("platform", PLATFORMS)
        .order("platform", { ascending: true })

      if (error) {
        throw error
      }

      setAccounts((data ?? []) as MetaAccount[])
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
      const payload = (await response.json().catch(() => ({}))) as {
        pages?: MetaPage[]
        error?: string
      }

      if (!response.ok) {
        throw new Error(payload.error ?? "Facebook Page 목록을 불러오지 못했습니다.")
      }

      const nextPages = payload.pages ?? []
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
    const error = searchParams.get("error")

    if (metaStatus === "connected") {
      toast.success("Meta 계정 연결이 완료되었습니다. 사용할 Facebook Page를 선택해 주세요.")
      loadPages()
    }

    if (error) {
      toast.error(error)
    }
  }, [loadPages])

  const handleConnectMeta = () => {
    window.location.href = "/api/auth/meta/start"
  }

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
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string
      }

      if (!response.ok) {
        throw new Error(payload.error ?? "Facebook Page 저장에 실패했습니다.")
      }

      await loadAccounts()
      toast.success("업로드에 사용할 Page와 Instagram Business 계정을 저장했습니다.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Facebook Page 저장에 실패했습니다.")
    } finally {
      setSavingPage(false)
    }
  }

  const handleDisconnect = async (platform: MetaPlatform) => {
    setDisconnecting(platform)

    try {
      const response = await fetch("/api/auth/meta/disconnect", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      })
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string
      }

      if (!response.ok) {
        throw new Error(payload.error ?? "연결 해제에 실패했습니다.")
      }

      await loadAccounts()
      toast.success(`${PLATFORM_NAMES[platform]} 연결을 해제했습니다.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "연결 해제에 실패했습니다.")
    } finally {
      setDisconnecting(null)
    }
  }

  const selectedPage = pages.find((page) => page.id === selectedPageId)

  return (
    <>
      <PageHeader
        title="연결 계정"
        description="Meta 계정을 연결하고 실제 업로드에 사용할 Facebook Page와 Instagram Business 계정을 선택합니다."
      />

      <div className="space-y-6 px-4 py-6 sm:px-6">
        <Alert className="border-amber-500/30 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle>Meta 연결 안내</AlertTitle>
          <AlertDescription>
            Instagram 업로드를 사용하려면 Instagram Business 또는 Creator 계정이 Facebook Page에 연결되어 있어야 합니다.
          </AlertDescription>
        </Alert>

        <div className="flex flex-wrap gap-2">
          <Button className="gap-2" onClick={handleConnectMeta}>
            <Plug className="h-4 w-4" />
            Facebook / Instagram 연결
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

        <div className="grid gap-4 md:grid-cols-2">
          {loadingAccounts && (
            <div className="col-span-full flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              연결 상태를 불러오는 중입니다.
            </div>
          )}
          {PLATFORMS.map((platform) => {
            const account = accountsByPlatform.get(platform)
            const status = getUiStatus(account)
            const isBusy = disconnecting === platform

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
                    <p>{account?.description ?? "아직 Meta 계정 연결 정보가 없습니다."}</p>
                    {account?.page_id && <p>Page ID: {account.page_id}</p>}
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
            <CardTitle className="text-base">업로드 Page 선택</CardTitle>
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
                    {selectedPage.instagram_business_account ? (
                      <p className="mt-1 text-muted-foreground">
                        연결된 Instagram:{" "}
                        {selectedPage.instagram_business_account.username ??
                          selectedPage.instagram_business_account.name ??
                          selectedPage.instagram_business_account.id}
                      </p>
                    ) : (
                      <p className="mt-1 text-amber-700 dark:text-amber-300">
                        이 Page에는 Instagram Business 계정이 연결되어 있지 않습니다.
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function getUiStatus(account?: MetaAccount): UiStatus {
  if (!account) {
    return "not_connected"
  }

  if (account.token_expires_at && new Date(account.token_expires_at).getTime() < Date.now()) {
    return "expired"
  }

  if (account.status === "connected") {
    return "connected"
  }

  return "needs_connection"
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}
