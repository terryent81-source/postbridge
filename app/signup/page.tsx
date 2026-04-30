"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BrandLogo } from "@/components/brand-logo"
import { signUpWithEmailPassword } from "@/lib/supabase/auth"

export default function SignupPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)

    const formData = new FormData(event.currentTarget)
    const displayName = String(formData.get("name") ?? "").trim()
    const email = String(formData.get("email") ?? "").trim()
    const password = String(formData.get("password") ?? "")
    const passwordConfirm = String(formData.get("password2") ?? "")
    const referralCode = String(formData.get("referral") ?? "").trim()

    if (password !== passwordConfirm) {
      toast.error("비밀번호가 일치하지 않습니다")
      setIsSubmitting(false)
      return
    }

    try {
      const { data, error } = await signUpWithEmailPassword({
        email,
        password,
        displayName,
        referralCode,
      })

      if (error) {
        toast.error("회원가입에 실패했습니다", {
          description: error.message,
        })
        return
      }

      if (data.session) {
        toast.success("회원가입이 완료되었습니다")
        router.replace("/dashboard")
        router.refresh()
        return
      }

      toast.success("회원가입 신청이 완료되었습니다", {
        description: "이메일 인증이 켜져 있다면 받은 편지함에서 인증을 완료해 주세요.",
      })
      router.replace("/login")
    } catch (error) {
      toast.error("Supabase Auth 설정을 확인해 주세요", {
        description: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
      })
    } finally {
      setIsSubmitting(false)
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
            <h1 className="text-2xl font-bold tracking-tight text-foreground">회원가입</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              매주 무료 업로드 3회로 시작하세요.
            </p>

            <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">이름</Label>
                <Input id="name" name="name" placeholder="홍길동" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">이메일</Label>
                <Input id="email" name="email" type="email" placeholder="you@example.com" required />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="password">비밀번호</Label>
                  <Input id="password" name="password" type="password" placeholder="••••••••" required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="password2">비밀번호 확인</Label>
                  <Input id="password2" name="password2" type="password" placeholder="••••••••" required />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="referral" className="flex items-center gap-2">
                  추천 코드 <span className="text-xs font-normal text-muted-foreground">(선택)</span>
                </Label>
                <Input id="referral" name="referral" placeholder="ABCD1234" />
              </div>
              <Button
                type="submit"
                size="lg"
                className="brand-gradient mt-2 text-primary-foreground hover:opacity-95"
                disabled={isSubmitting}
              >
                {isSubmitting ? "가입 처리 중..." : "가입하기"}
              </Button>
              <p className="text-center text-xs leading-relaxed text-muted-foreground">
                가입 시{" "}
                <a href="#" className="underline">
                  이용약관
                </a>
                과{" "}
                <a href="#" className="underline">
                  개인정보처리방침
                </a>
                에 동의하게 됩니다.
              </p>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              이미 계정이 있으신가요?{" "}
              <Link href="/login" className="font-semibold text-primary hover:underline">
                로그인
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
