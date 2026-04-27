import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Star, Quote } from "lucide-react"

const TESTIMONIALS = [
  {
    name: "김지윤",
    role: "푸드 크리에이터 · @jiyoon.eats",
    initials: "지윤",
    quote:
      "예전엔 5개 플랫폼에 같은 영상 올리는 데 1시간 넘게 걸렸어요. 이젠 한 번 작성하고 5초면 끝, 본업에 집중할 시간이 생겼습니다.",
  },
  {
    name: "박세훈",
    role: "마케팅 매니저 · 브런치몰",
    initials: "세훈",
    quote:
      "예약 업로드와 업로드 기록 추적이 정말 강력합니다. 캠페인 별 KPI 리포트 만들 때 이만한 도구가 없어요.",
  },
  {
    name: "이수아",
    role: "1인 쇼핑몰 대표 · 모먼트",
    initials: "수아",
    quote:
      "Free 플랜으로 시작했다가 한 달 만에 Pro로 업그레이드했어요. 가격 대비 효율이 압도적입니다.",
  },
]

export function Testimonials() {
  return (
    <section aria-label="고객 후기" className="bg-background py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            Loved by Creators
          </p>
          <h2 className="mt-2 text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            크리에이터·브랜드가 매일 사용하는 도구
          </h2>
          <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground">
            반복 업로드에서 해방된 사용자들이 직접 들려주는 이야기입니다.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <Card
              key={t.name}
              className="group relative overflow-hidden border-border/80 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg"
            >
              <Quote
                className="absolute right-5 top-5 h-9 w-9 text-primary/10 transition-colors group-hover:text-primary/20"
                aria-hidden="true"
              />
              <CardContent className="flex h-full flex-col gap-5 p-6">
                <div className="flex" aria-label="평점 5점">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />
                  ))}
                </div>
                <p className="flex-1 text-pretty text-sm leading-relaxed text-foreground">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="flex items-center gap-3 border-t border-border pt-4">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="brand-gradient text-xs font-bold text-primary-foreground">
                      {t.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-foreground">{t.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
