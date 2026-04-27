"use client"

import { useEffect, useState } from "react"
import { PageHeader } from "@/components/app/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { PlatformIcon } from "@/components/platform-icon"
import {
  ACCOUNT_STATUS_LABELS,
  connectAccount,
  disconnectAccount,
  getSocialAccounts,
  mapSocialAccountToUi,
  MOCK_DB_CHANGED_EVENT,
  type AccountStatus,
  type Platform,
  type UiSocialAccount,
} from "@/lib/db"
import { AlertTriangle, Check, Plug, RefreshCw, Unplug } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const STATUS_TONE: Record<AccountStatus, string> = {
  connected: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400",
  needs_connection: "bg-muted text-muted-foreground border-border",
  expired: "bg-destructive/10 text-destructive border-destructive/20",
}

const PLATFORM_NAMES: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
  tiktok: "TikTok",
  x: "X",
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<UiSocialAccount[]>([])
  const [busy, setBusy] = useState<Platform | null>(null)

  const reload = async () => {
    const rows = await getSocialAccounts()
    setAccounts(rows.map(mapSocialAccountToUi))
  }

  useEffect(() => {
    reload()
    window.addEventListener(MOCK_DB_CHANGED_EVENT, reload)
    return () => window.removeEventListener(MOCK_DB_CHANGED_EVENT, reload)
  }, [])

  const handleConnect = async (platform: Platform) => {
    setBusy(platform)
    setAccounts((prev) =>
      prev.map((acc) =>
        acc.platform === platform
          ? {
              ...acc,
              status: "connected",
              handle: acc.handle ?? `@${platform}_user`,
            }
          : acc,
      ),
    )
    try {
      await connectAccount(platform)
      await reload()
      toast.success(`${PLATFORM_NAMES[platform]} 인증을 완료했습니다.`)
    } catch (error) {
      await reload()
      toast.error(error instanceof Error ? error.message : "연결에 실패했습니다.")
    } finally {
      setBusy(null)
    }
  }

  const handleDisconnect = async (platform: Platform) => {
    setBusy(platform)
    setAccounts((prev) =>
      prev.map((acc) =>
        acc.platform === platform
          ? {
              ...acc,
              status: "needs_connection",
              handle: undefined,
            }
          : acc,
      ),
    )
    try {
      await disconnectAccount(platform)
      await reload()
      toast.success(`${PLATFORM_NAMES[platform]} 연결을 해제했습니다.`)
    } catch (error) {
      await reload()
      toast.error(error instanceof Error ? error.message : "연결 해제에 실패했습니다.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <PageHeader
        title="SNS 계정 연결"
        description="업로드에 사용할 SNS 계정을 한곳에서 관리하세요."
      />
      <div className="space-y-6 px-4 py-6 sm:px-6">
        <Alert className="border-amber-500/30 bg-amber-500/10 text-foreground">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800 dark:text-amber-300">
            연결 전 확인사항
          </AlertTitle>
          <AlertDescription className="text-foreground/90">
            일부 플랫폼은 Business 또는 Creator 계정, API 심사, 추가 권한 승인이 필요할 수 있습니다.
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 md:grid-cols-2">
          {accounts.map((acc) => (
            <Card key={acc.platform} className="border-border/80 shadow-sm">
              <CardContent className="flex flex-col gap-4 p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <PlatformIcon platform={acc.platform} size="lg" />
                    <div>
                      <h3 className="text-base font-bold text-foreground">
                        {PLATFORM_NAMES[acc.platform]}
                      </h3>
                      {acc.handle && (
                        <p className="text-xs text-muted-foreground">{acc.handle}</p>
                      )}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                      STATUS_TONE[acc.status],
                    )}
                  >
                    {acc.status === "connected" && <Check className="h-3 w-3" />}
                    {acc.status === "expired" && <AlertTriangle className="h-3 w-3" />}
                    {ACCOUNT_STATUS_LABELS[acc.status]}
                  </span>
                </div>

                <p className="text-sm leading-relaxed text-muted-foreground">{acc.description}</p>

                <div className="flex gap-2 pt-1">
                  {acc.status === "connected" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-destructive hover:text-destructive"
                      disabled={busy === acc.platform}
                      onClick={() => handleDisconnect(acc.platform)}
                    >
                      <Unplug className="h-3.5 w-3.5" /> 연결 해제
                    </Button>
                  ) : acc.status === "expired" ? (
                    <Button
                      size="sm"
                      className="brand-gradient gap-1.5 text-primary-foreground hover:opacity-95"
                      disabled={busy === acc.platform}
                      onClick={() => handleConnect(acc.platform)}
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> 다시 연결
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="brand-gradient gap-1.5 text-primary-foreground hover:opacity-95"
                      disabled={busy === acc.platform}
                      onClick={() => handleConnect(acc.platform)}
                    >
                      <Plug className="h-3.5 w-3.5" /> 연결하기
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </>
  )
}
