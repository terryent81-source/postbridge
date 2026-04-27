import { Card, CardContent } from "@/components/ui/card"
import { Clock, LayoutGrid, Gift } from "lucide-react"

const ITEMS = [
  {
    icon: Clock,
    title: "반복 작업을 줄입니다",
    desc: "여러 플랫폼에 똑같은 콘텐츠를 일일이 올리는 시간을 한 번에 줄여, 진짜 중요한 일에 집중하세요.",
  },
  {
    icon: LayoutGrid,
    title: "한곳에서 모두 처리합니다",
    desc: "콘텐츠 작성, 예약, 업로드 기록 관리까지 단일 워크스페이스에서 통합 운영합니다.",
  },
  {
    icon: Gift,
    title: "부담 없는 시작",
    desc: "매주 무료 업로드 3회와 추천 보상을 제공해, 비용 부담 없이 바로 시작할 수 있습니다.",
  },
]

export function Why() {
  return (
    <section id="why" className="border-y border-border bg-background py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">Why PostBridge</p>
          <h2 className="mt-2 text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            왜 이 서비스가 필요한가요?
          </h2>
          <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground">
            크리에이터·마케터·1인 비즈니스를 위해, 단순 반복 업로드를 자동화하고
            콘텐츠의 임팩트는 더 크게 만듭니다.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {ITEMS.map((item, i) => (
            <Card
              key={i}
              className="card-hover group border-border/80 shadow-sm hover:border-primary/30 hover:shadow-lg"
            >
              <CardContent className="flex flex-col gap-4 p-6">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary ring-4 ring-primary/5 transition-all group-hover:bg-primary/15 group-hover:ring-primary/10">
                  <item.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="text-lg font-bold text-foreground">{item.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
