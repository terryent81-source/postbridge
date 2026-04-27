import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

export function FinalCta() {
  return (
    <section className="py-20 sm:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="brand-gradient relative overflow-hidden rounded-3xl px-6 py-14 text-center shadow-2xl shadow-primary/20 sm:px-10 sm:py-20">
          <div
            className="absolute inset-0 -z-0 opacity-30"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.25), transparent 40%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.18), transparent 45%)",
            }}
            aria-hidden="true"
          />
          <h2 className="relative text-balance text-3xl font-extrabold tracking-tight text-primary-foreground sm:text-4xl md:text-5xl">
            지금 SNS 업로드를 더 쉽게 시작하세요.
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-pretty text-base text-primary-foreground/90 sm:text-lg">
            한 번의 클릭으로 모든 플랫폼에 동시에 게시. 매주 무료 3회로 부담 없이 시작합니다.
          </p>
          <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="press-effect h-12 bg-card px-6 text-base font-semibold text-foreground shadow-lg hover:bg-card/95 hover:shadow-xl"
            >
              <Link href="/signup">
                무료로 시작하기
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="press-effect h-12 border-primary-foreground/30 bg-transparent px-6 text-base text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <Link href="/dashboard">데모 보기</Link>
            </Button>
          </div>
          <p className="relative mt-5 text-xs text-primary-foreground/80">
            신용카드 등록 없이 30초 만에 시작 · 언제든 취소 가능
          </p>
        </div>
      </div>
    </section>
  )
}
