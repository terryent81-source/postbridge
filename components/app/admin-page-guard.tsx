"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ShieldAlert } from "lucide-react"

type GuardState = "checking" | "allowed" | "forbidden" | "error"

type AdminPageGuardProps = {
  children: React.ReactNode
  requiredRole?: "admin" | "super_admin"
}

export function AdminPageGuard({
  children,
  requiredRole = "admin",
}: AdminPageGuardProps) {
  const router = useRouter()
  const [state, setState] = useState<GuardState>("checking")

  useEffect(() => {
    let mounted = true

    const checkAdmin = async () => {
      try {
        const response = await fetch("/api/admin/me", { cache: "no-store" })

        if (!mounted) {
          return
        }

        if (response.status === 401) {
          router.replace("/login")
          return
        }

        if (response.status === 403) {
          setState("forbidden")
          return
        }

        if (!response.ok) {
          setState("error")
          return
        }

        const payload = await response.json()
        if (requiredRole === "super_admin" && payload.role !== "super_admin") {
          setState("forbidden")
          return
        }

        setState("allowed")
      } catch {
        if (mounted) {
          setState("error")
        }
      }
    }

    checkAdmin()

    return () => {
      mounted = false
    }
  }, [requiredRole, router])

  if (state === "allowed") {
    return <>{children}</>
  }

  if (state === "checking") {
    return (
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <Card className="border-border/80 shadow-sm">
          <CardContent className="p-6 text-sm text-muted-foreground">
            관리자 권한을 확인하고 있습니다...
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <Card className="border-border/80 shadow-sm">
        <CardContent className="flex flex-col items-start gap-4 p-6">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <ShieldAlert className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-base font-bold text-foreground">
              관리자만 접근 가능합니다
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              관리자 권한이 필요한 페이지입니다.
            </p>
          </div>
          <Button onClick={() => router.replace("/dashboard")}>대시보드로 이동</Button>
        </CardContent>
      </Card>
    </div>
  )
}
