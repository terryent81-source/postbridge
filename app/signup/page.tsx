import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BrandLogo } from "@/components/brand-logo"

export default function SignupPage() {
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

            <form className="mt-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">이름</Label>
                <Input id="name" placeholder="홍길동" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">이메일</Label>
                <Input id="email" type="email" placeholder="you@example.com" required />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="password">비밀번호</Label>
                  <Input id="password" type="password" placeholder="••••••••" required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="password2">비밀번호 확인</Label>
                  <Input id="password2" type="password" placeholder="••••••••" required />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="referral" className="flex items-center gap-2">
                  추천 코드 <span className="text-xs font-normal text-muted-foreground">(선택)</span>
                </Label>
                <Input id="referral" placeholder="ABCD1234" />
              </div>
              <Button
                asChild
                size="lg"
                className="brand-gradient mt-2 text-primary-foreground hover:opacity-95"
              >
                <Link href="/dashboard">가입하기</Link>
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
