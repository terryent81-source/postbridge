"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { BrandLogo } from "@/components/brand-logo"
import { signInWithEmailPassword, signInWithGoogleOAuth } from "@/lib/supabase/auth"

export default function LoginPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false)
  const [oauthError, setOauthError] = useState<string | null>(null)

  useEffect(() => {
    const error = new URLSearchParams(window.location.search).get("error")

    if (error === "oauth") {
      setOauthError("Google login failed. Please try again.")
    }
  }, [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setOauthError(null)

    const formData = new FormData(event.currentTarget)
    const email = String(formData.get("email") ?? "").trim()
    const password = String(formData.get("password") ?? "")

    try {
      const { error } = await signInWithEmailPassword(email, password)

      if (error) {
        toast.error("로그인에 실패했습니다", {
          description: error.message,
        })
        return
      }

      toast.success("로그인되었습니다")
      const nextPath = new URLSearchParams(window.location.search).get("next")
      router.replace(getSafeNextPath(nextPath))
      router.refresh()
    } catch (error) {
      toast.error("Supabase Auth 설정을 확인해 주세요", {
        description: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleGoogleSignIn() {
    setIsGoogleSubmitting(true)
    setOauthError(null)

    try {
      const nextPath = getSafeNextPath(
        new URLSearchParams(window.location.search).get("next"),
      )
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`
      const { error } = await signInWithGoogleOAuth(redirectTo)

      if (error) {
        setOauthError(error.message)
        setIsGoogleSubmitting(false)
      }
    } catch (error) {
      setOauthError(
        error instanceof Error ? error.message : "Google login failed. Please try again.",
      )
      setIsGoogleSubmitting(false)
    }
  }

  return (
    <main className="brand-soft-bg flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Link href="/">
            <BrandLogo />
          </Link>
        </div>
        <Card className="border-border/80 shadow-xl shadow-primary/5">
          <CardContent className="p-7">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">로그인</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              PostBridge에 오신 것을 환영합니다.
            </p>

            <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">이메일</Label>
                <Input id="email" name="email" type="email" placeholder="you@example.com" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">비밀번호</Label>
                  <a href="#" className="text-xs text-primary hover:underline">
                    비밀번호를 잊으셨나요?
                  </a>
                </div>
                <Input id="password" name="password" type="password" placeholder="••••••••" required />
              </div>
              <Button
                type="submit"
                size="lg"
                className="brand-gradient mt-2 text-primary-foreground hover:opacity-95"
                disabled={isSubmitting}
              >
                {isSubmitting ? "로그인 중..." : "로그인"}
              </Button>
            </form>

            <div className="my-6 flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">또는</span>
              <Separator className="flex-1" />
            </div>

            {oauthError ? (
              <p
                role="alert"
                className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {oauthError}
              </p>
            ) : null}

            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full gap-2 bg-card"
              disabled={isSubmitting || isGoogleSubmitting}
              onClick={handleGoogleSignIn}
            >
              <GoogleIcon />
              {isGoogleSubmitting ? "Connecting to Google..." : "Google로 계속하기"}
            </Button>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              계정이 없으신가요?{" "}
              <Link href="/signup" className="font-semibold text-primary hover:underline">
                회원가입
              </Link>
            </p>
          </CardContent>
        </Card>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Link href="/" className="hover:text-foreground">
            ← 홈으로 돌아가기
          </Link>
        </p>
      </div>
    </main>
  )
}

function getSafeNextPath(nextPath: string | null) {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/dashboard"
  }

  return nextPath
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.6 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.95 4 4 12.95 4 24s8.95 20 20 20 20-8.95 20-20c0-1.3-.1-2.6-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.1l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.1z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.6 2.4-7.2 2.4-5.3 0-9.7-3.4-11.3-8L6.2 33C9.6 39.5 16.3 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C41.5 36.3 44 30.7 44 24c0-1.3-.1-2.6-.4-3.5z"
      />
    </svg>
  )
}
